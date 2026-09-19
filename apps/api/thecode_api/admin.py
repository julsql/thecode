"""Administration des codes, en ligne de commande.

Les codes d'invitation, de parrainage et à vie n'ont pas d'écran : ils se
distribuent à la main, rarement, et une interface d'administration exposée sur
Internet serait une porte de plus sur un service qui garde des carnets.

    kubectl exec -n thecode deploy/thecode-api -- \\
        python -m thecode_api.admin codes create --kind lifetime AVIE

Sans cet outil, les codes resteraient une table que personne ne peut remplir.
"""

from __future__ import annotations

import argparse
import sys
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from .codes import KINDS, normalize
from .db import session_scope
from .models import Code


def create_code(
    db: DbSession,
    code: str,
    kind: str,
    coupon: str = "",
    max_uses: int = 0,
    expires_in_days: int | None = None,
    note: str = "",
) -> Code:
    value = normalize(code)
    if not value:
        raise ValueError("Le code ne peut pas être vide.")
    if kind not in KINDS:
        raise ValueError(f"Type inconnu : {kind!r}. Attendu {', '.join(KINDS)}.")
    # Un code de parrainage sans coupon ne remiserait rien : autant le dire
    # maintenant plutôt qu'au premier filleul qui paie le plein tarif.
    if kind == "referral" and not coupon:
        raise ValueError("Un code de parrainage a besoin d'un coupon Stripe (--coupon).")
    if db.scalars(select(Code).where(Code.code == value)).one_or_none() is not None:
        raise ValueError(f"Le code {value} existe déjà.")

    row = Code(
        code=value,
        kind=kind,
        stripe_coupon_id=coupon,
        max_uses=max_uses,
        note=note,
        expires_at=(
            datetime.now(UTC) + timedelta(days=expires_in_days)
            if expires_in_days is not None
            else None
        ),
    )
    db.add(row)
    db.commit()
    return row


def disable_code(db: DbSession, code: str) -> Code:
    row = db.scalars(select(Code).where(Code.code == normalize(code))).one_or_none()
    if row is None:
        raise ValueError(f"Code inconnu : {code}")
    # Désactivé plutôt que supprimé : l'historique des comptes qui l'ont
    # utilisé reste lisible, et une désactivation se rattrape.
    row.active = False
    db.commit()
    return row


def list_codes(db: DbSession) -> list[Code]:
    return list(db.scalars(select(Code).order_by(Code.created_at)).all())


def _describe(code: Code) -> str:
    uses = f"{code.used_count}/{code.max_uses}" if code.max_uses else str(code.used_count)
    expiry = code.expires_at.date().isoformat() if code.expires_at else "sans expiration"
    state = "actif" if code.active else "désactivé"
    coupon = f" coupon={code.stripe_coupon_id}" if code.stripe_coupon_id else ""
    return f"{code.code:<20} {code.kind:<9} {state:<10} usages={uses:<8} {expiry}{coupon}"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="thecode-admin", description=__doc__)
    sub = parser.add_subparsers(dest="group", required=True)
    codes = sub.add_parser("codes", help="Codes d'invitation, de parrainage et à vie")
    actions = codes.add_subparsers(dest="action", required=True)

    create = actions.add_parser("create")
    create.add_argument("code")
    create.add_argument("--kind", choices=KINDS, required=True)
    create.add_argument("--coupon", default="", help="Identifiant de coupon Stripe")
    create.add_argument("--max-uses", type=int, default=0, help="0 = sans limite")
    create.add_argument("--expires-in-days", type=int, default=None)
    create.add_argument("--note", default="")

    actions.add_parser("list")
    disable = actions.add_parser("disable")
    disable.add_argument("code")

    args = parser.parse_args(argv)

    with session_scope() as db:
        try:
            if args.action == "create":
                row = create_code(
                    db,
                    args.code,
                    args.kind,
                    coupon=args.coupon,
                    max_uses=args.max_uses,
                    expires_in_days=args.expires_in_days,
                    note=args.note,
                )
                print(_describe(row))
            elif args.action == "disable":
                print(_describe(disable_code(db, args.code)))
            else:
                rows = list_codes(db)
                if not rows:
                    print("Aucun code.")
                for row in rows:
                    print(_describe(row))
        except ValueError as exc:
            print(f"Échec : {exc}", file=sys.stderr)
            return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
