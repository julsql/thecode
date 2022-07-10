import Foundation

let alphabets = ["pamqlsoziekdjfurythgnwbxvc", "wqapmloikxszedcjuyhnvfrtgb", "qaszdefrgthyjukilompcvbnxw", "nhybgtvfrcdexszwqajuiklopm", "mlkjhgfdsqwxcvbnpoiuytreza", "ijnbhuygvcftrdxwsezqakolpm", "poiuytrezamlkjhgfdsqnbvcxw", "wxcvbnqsdfghjklmazertyuiop", "unybtvrcexzwaqikolpmjhgfds", "oplmkjuiytghbnvcfdrezasqxw", "sezqadrftwxcgyvhubjinkolpm", "jfkdlsmqhgpaozieurytvcbxnw", "gftrhdyejsuzkqailompnwbxvc", "frgthyjukilompnbvcxwedzsaq", "gftryehdjsuziakqlopmnwbxvc", "mlkjhgfdsqxecrvtbynuiopwza", "pamqlsoziekdjfurythgnwbvcx", "jklmuiopdfghertyqsazwxcvbn", "vgfcbhdxnjwskiqazolmpertyu", "onbivucyxtwrezapgjhklmfdsq", "portezcviuxwhskyajgblndqfm", "qposidufygthjreklzmawnxbvc", "pwoxicuvbtynrmelzakjhgfdsq", "hajzkelrmtgyfudisoqpnbvxcw", "wqxscdvfbgnhjukilompytreza", "thequickbrownfxjmpsvlazydg", "abcdefghijklmnopqrstuvwxyz"]

func index(lettre : Character, ref : String) -> Int {
    // Renvoie la place de la lettre dans la reférence donnée
    let index: Int = ref.distance(from: ref.startIndex, to: ref.range(of: String(lettre))!.lowerBound)
    return index
}

func codeLettre(site : String, clef : String) -> String {
    // code en vigenere
    let site2 = site.lowercased()
    let clef2 = clef.lowercased()
    var code = ""
    for i in 0...site.count-1 {
        let alpha1 = alphabet(lettre : site2[site2.index(site2.startIndex, offsetBy: 1)])
        let alpha2 = alphabet(lettre : site2[site2.index(site2.startIndex, offsetBy: 0)])
        let alpha3 = alphabet(lettre : clef2[clef2.index(clef2.startIndex, offsetBy: 0)])
        
        let a = index(lettre : site2[site2.index(site2.startIndex, offsetBy: i)], ref : alpha2)
        let b = index(lettre : clef2[clef2.index(clef2.startIndex, offsetBy: i%(clef.count))], ref : alpha3)
        let c = alpha1[alpha1.index(alpha1.startIndex, offsetBy: ((a+b)%26))]
        code = code + String(c)
    }
    return code
}

func codeChiffre(site : String, A : Int, B : Int) -> String{
    let site2 = site.lowercased()
    var code = ""
    for i in 0...site.count-1 {
        let alpha0 = alphabet(lettre : site2[site2.index(site2.startIndex, offsetBy: 0)])
        let alpha1 = alphabet(lettre : alpha0[alpha0.index(alpha0.startIndex, offsetBy: A % alpha0.count)])
        let alpha2 = alphabet(lettre : alpha0[alpha0.index(alpha0.startIndex, offsetBy: B % alpha0.count)])
        let mot = index(lettre : site2[site2.index(site2.startIndex, offsetBy: i)], ref : alpha2)

        let c = alpha1[alpha1.index(alpha1.startIndex, offsetBy: ((A * mot + B) % 26))]
        code = code + String(c)
    }
    return code
}

private func alphabet(lettre : Character) -> String {
       // Génère un alphabet selon la lettre donnée
       return alphabets[index(lettre : lettre, ref : alphabets[26])]
   }

func longueur(site : String) -> String {
    // renvoie un mot dans la bonne longueur
    let site3 = site.lowercased()
    let L = alphabet(lettre : site3[site3.index(site3.startIndex, offsetBy: 0)])
    var site2 = ""
    for i in 0...(site3.count*2)-1 {
        if i%2 == 0 {
            site2.append(site3[site3.index(site3.startIndex, offsetBy: i/2)])
        }
        else {
            site2.append(L[L.index(L.startIndex, offsetBy: i/2)])
        }
    }
    let T = alphabet(lettre : site2[site2.index(site2.startIndex, offsetBy: 1)])
    if site2.count < 20 {
        for i in 0...20-(site2.count)-1 {
            site2.append(T[T.index(T.startIndex, offsetBy: i)])
        }
    }
    else {
        site2 = String(site2.prefix(20))
    }
    return site2
}

func couleur(bits : Int) -> Array<String> {
    // renvoie la sécurité en fonction du nombre de bits
    var secure = ""
    var color = ""
    if bits < 64 {
        secure = " Très Faible "
        color = "#FE0101"
        }
    else if bits < 80 {
        secure = " Faible "
        color = "#FE4501"
        }
    else if bits < 100 {
        secure = " Moyenne "
        color = "#FE7601"
        }
    else if bits < 128 {
        secure = " Forte "
        color = "#53FE38"
        }
    else {
        secure = " Très Forte "
        color = "#1CD001"
        }
    return [secure, color]
}

func complexification(code : String, minState : Bool, majState : Bool, symState : Bool, chiState : Bool, len2 : Int) -> Array<Any> {
    // Complexifie le mot de passe
    let alpha1 = alphabet(lettre : code[code.index(code.startIndex, offsetBy: 0)]).uppercased()
    let alpha2 = alphabet(lettre : code[code.index(code.startIndex, offsetBy: 1)])
    let symboles = "@#&!)-_%;:*$+=/?<>&-?($*@#"
    let len = code.count
    var nb_carac: Int
    var lettrei: Character
    var code2 = ""
    let code3 = code.uppercased()
    
    if (minState && !majState && !symState && !chiState) {
        nb_carac = 26
        code2 = code
    }
    else if (!minState && majState && !symState && !chiState) {
        nb_carac = 26
        code2 = code.uppercased()
    }
    else if (!minState && !majState && symState && !chiState){
        nb_carac = 26
        for i in 0...len-1 {
            lettrei = code[code.index(code.startIndex, offsetBy: i)]
            code2.append(symboles[symboles.index(symboles.startIndex, offsetBy: index(lettre: lettrei, ref: alpha2))])
        }
    }
    else if (!minState && !majState && !symState && chiState) {
        nb_carac = 10
        for i in 0...len-1 {
            lettrei = code[code.index(code.startIndex, offsetBy: i)]
            code2.append(String(index(lettre: lettrei, ref: alpha2)))
        }
    }
    else if (minState && majState && !symState && !chiState) {
        nb_carac = 52
        for i in 0...len-1 {
            if (i%2 == 0){
                lettrei = code[code.index(code.startIndex, offsetBy: i)]
                code2.append(lettrei);
            }
            else {
                lettrei = code3[code3.index(code3.startIndex, offsetBy: i)]
                code2.append(lettrei);
            }
        }
    }
    else if (minState && !majState && symState && !chiState) {
        nb_carac = 52
        for i in 0...len-1 {
            lettrei = code[code.index(code.startIndex, offsetBy: i)]
            if (i%2 == 0){
                code2.append(symboles[symboles.index(symboles.startIndex, offsetBy: index(lettre: lettrei, ref: alpha2))])
            }
            else { code2.append(lettrei);
            }
        }
    }
    else if (minState && !majState && !symState) {
        nb_carac = 36
        for i in 0...len-1 {
            lettrei = code[code.index(code.startIndex, offsetBy: i)]
            if (i%2 == 0){
                code2.append(lettrei);
            }
            else {
                code2.append(String(index(lettre: lettrei, ref: alpha2)))
            }
        }
    }
    else if (!minState && majState && symState && !chiState) {
        nb_carac = 52
        for i in 0...len-1 {
            lettrei = code3[code3.index(code3.startIndex, offsetBy: i)]
            if (i%2 == 0){
                code2.append(symboles[symboles.index(symboles.startIndex, offsetBy: index(lettre: lettrei, ref: alpha1))])
            }
            else {
                code2.append(lettrei);
            }
        }
    }
    else if (!minState && majState && !symState) {
        nb_carac = 36
        for i in 0...len-1 {
            lettrei = code3[code3.index(code3.startIndex, offsetBy: i)]
            if (i%2 == 0){
                code2.append(lettrei);
            }
            else {
                code2.append(String(index(lettre: lettrei, ref: alpha1)))
            }
        }
    }
    else if (!minState && !majState && symState) {
        nb_carac = 36
        for i in 0...len-1 {
            lettrei = code[code.index(code.startIndex, offsetBy: i)]
            if (i%2 == 0){
                code2.append(symboles[symboles.index(symboles.startIndex, offsetBy: index(lettre: lettrei, ref: alpha2))])
            }
            else {
                code2.append(String(index(lettre: lettrei, ref: alpha2)))
            }
        }
    }
    else if (minState && majState && symState && !chiState) {
        nb_carac = 78
        for i in 0...len-1 {
            if (i % 3 == 0) {
                lettrei = code[code.index(code.startIndex, offsetBy: i)]
                code2.append(symboles[symboles.index(symboles.startIndex, offsetBy: index(lettre: lettrei, ref: alpha2))])
            }
            else if (i % 3 == 1) {
                lettrei = code[code.index(code.startIndex, offsetBy: i)]
                code2.append(lettrei);
            }
            else {
                lettrei = code3[code3.index(code3.startIndex, offsetBy: i)]
                code2.append(lettrei);
            }
        }
    }
    else if (!minState && majState) {
        nb_carac = 62
        for i in 0...len-1 {
            if (i % 3 == 0) {
                lettrei = code[code.index(code.startIndex, offsetBy: i)]
                code2.append(String(index(lettre: lettrei, ref: alpha2)))
            }
            else if (i % 3 == 1) {
                lettrei = code[code.index(code.startIndex, offsetBy: i)]
                code2.append(symboles[symboles.index(symboles.startIndex, offsetBy: index(lettre: lettrei, ref: alpha2))])
            }
            else {
                lettrei = code3[code3.index(code3.startIndex, offsetBy: i)]
                code2.append(lettrei);
            }
        }
    }
    else if (minState && !majState) {
        nb_carac = 62
        for i in 0...len-1 {
            lettrei = code[code.index(code.startIndex, offsetBy: i)]
            if (i % 3 == 0) {
                code2.append(lettrei);
            }
            else if (i % 3 == 1) {
                code2.append(symboles[symboles.index(symboles.startIndex, offsetBy: index(lettre: lettrei, ref: alpha2))])
            }
            else {
                code2.append(String(index(lettre: lettrei, ref: alpha2)))
            }
        }
    }
    else if (minState && !symState) {
        nb_carac = 62
        for i in 0...len-1 {
            if (i % 3 == 0) {
                lettrei = code3[code3.index(code3.startIndex, offsetBy: i)]
                code2.append(lettrei);
            }
            else if (i % 3 == 1) {
                lettrei = code[code.index(code.startIndex, offsetBy: i)]
                code2.append(lettrei);
            }
            else {
                lettrei = code[code.index(code.startIndex, offsetBy: i)]
                code2.append(String(index(lettre: lettrei, ref: alpha2)))
            }
        }
    }
    else if (minState){
        nb_carac = 88
        for i in 0...len-1 {
            if (i % 4 == 0) {
                lettrei = code[code.index(code.startIndex, offsetBy: i)]
                code2.append(symboles[symboles.index(symboles.startIndex, offsetBy: index(lettre: lettrei, ref: alpha2))])
            }
            else if (i % 4 == 1) {
                lettrei = code[code.index(code.startIndex, offsetBy: i)]
                code2.append(lettrei);
            }
            else if i % 4 == 2 {
                lettrei = code[code.index(code.startIndex, offsetBy: i)]
                code2.append(String(index(lettre: lettrei, ref: alpha2)))
            }
            else {
                lettrei = code3[code3.index(code3.startIndex, offsetBy: i)]
                code2.append(lettrei);
            }
        }
    }
    else {
        nb_carac = 0;
        code2 = code;
    }
    let len3 = len2*len2 + 3*len2 + 10
    code2 = String(code2.prefix(len3))
    let safe = Int(round((log(pow(Double(nb_carac),Double(code3.count)))/log(2.0))))
    let result = couleur(bits : safe)
    if safe == 0 {
        code2 = ""
    }
    return [code2, result[0] + String(safe) + " bits", safe , result[1]]
}

// test commande

let site = "site"
let clef = "clef"
let A = 4
let B = 7

print(complexification(code: codeChiffre(site: longueur(site: site), A: A, B :B), minState: true, majState: true, symState: true, chiState: true, len2: 2))
print(complexification(code: codeLettre(site: longueur(site: site), clef: clef), minState: true, majState: true, symState: true, chiState: true, len2: 2))
