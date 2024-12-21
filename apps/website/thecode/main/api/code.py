from django.http import HttpResponseBadRequest, HttpRequest, JsonResponse

from main.api import generate_code


def code(request: HttpRequest):
    if not request.GET.get('clef'):
        return HttpResponseBadRequest("Attribut 'clef' requis")
    if not request.GET.get('site'):
        return HttpResponseBadRequest("Attribut 'site' requis")

    clef = request.GET.get('clef')
    site = request.GET.get('site')
    min_state = request.GET.get('no_min') is None
    maj_state = request.GET.get('no_maj') is None
    sym_state = request.GET.get('no_sym') is None
    chi_state = request.GET.get('no_chi') is None
    longueur = int(request.GET.get('length')) if request.GET.get('length', '').isdigit() else 20

    code_result = generate_code.code(site, clef, min_state, maj_state, sym_state, chi_state, longueur)

    response = JsonResponse(code_result, json_dumps_params={'ensure_ascii': False})
    response['Content-Type'] = 'application/json; charset=utf-8'
    return response
