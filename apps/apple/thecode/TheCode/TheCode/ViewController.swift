//
//  ViewController.swift
//  TheCode
//
//  Created by Jul SQL on 17/04/2020.
//  Copyright © 2020 Jul SQL. All rights reserved.
//

import UIKit
import Foundation
import CryptoKit
import Darwin

class ViewController: UIViewController {
    
    // MARK : Outlets
    @IBOutlet weak var securiteLabel: UILabel!
    @IBOutlet weak var longueurLabel: UILabel!
    
    @IBOutlet weak var clefTextField: UITextField!
    @IBOutlet weak var siteTextField: UITextField!
    @IBOutlet weak var motPasseTextField: UITextField!
    
    @IBOutlet weak var questionButton: UIButton!
    @IBOutlet weak var copyButton: UIButton!
    @IBOutlet weak var infoApp: UIButton!
    @IBOutlet weak var shareButton: UIButton!
    
    @IBOutlet weak var minSwitch: UISwitch!
    @IBOutlet weak var majSwitch: UISwitch!
    @IBOutlet weak var symSwitch: UISwitch!
    @IBOutlet weak var chiSwitch: UISwitch!
    
    @IBOutlet weak var longueurSlider: UISlider!
    @IBOutlet weak var securiteSlider: UISlider!
    
    // Mark : Propreties
    
    override func viewDidLoad() {
        // Au démarrage de l'application
        super.viewDidLoad()
        securiteLabel.text = "Très Forte 126 bits"
        securiteLabel.textColor = UIColor.green
        setupbutton()
        ViewTextFieldManager()
        longueurSlider.value = 20
        securiteSlider.value = 94
        copyButton.setImage(UIImage(named: "pressepapier.png"), for: UIControl.State.normal)
        shareButton.setImage(UIImage(named: "partager.png"), for: UIControl.State.normal)
    }
    
    
    // Mark : Variables initialisation
    
    var minState = true
    var majState = true
    var symState = true
    var chiState = true
    var longueur = 20
    var base = ""

    // Mark : private function

    private func setupbutton() {
        // Changer les coins des boutons
        questionButton.layer.cornerRadius = 15
        copyButton.layer.cornerRadius = 15
        infoApp.layer.cornerRadius = 15
    }
    
    
    private func ViewTextFieldManager() {
        // Ferme le clavier lorsqu'on tape sur l'ecran
        clefTextField.delegate = self
        siteTextField.delegate = self
        motPasseTextField.delegate = self
        
        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(hideKeyboard))
        view.addGestureRecognizer(tapGesture)
    }
    
    
    private func dec2base(x : BInt, base : String) -> String{
        // Convertit un BigInteger dans une base ayant base comme support
        
        let b = base.count
        var result  = String(base[Int(x % b)])
        var inter = (x / b) - 1

        while inter != -1 {
            result = String(base[Int(inter % b)]) + result
            inter = (inter / b) - 1
        }
        return result
    }
    
    
    private func generer() {
        // Génère le mot de passe
        
        modifBase()
        motPasseTextField.text = "Il manque des valeurs"
        modifSecurite()
        if clefTextField.text == "" || siteTextField.text == "" {
            // Rien dans site ou dans clef
        }
        else if !(minState || majState || symState || chiState) {
            showToast(message : "Rien n'est coché")
        }
        else {
            let result = modification(mot : (siteTextField.text! + clefTextField.text!))
            motPasseTextField.text = result[0] as? String
        }
    }
    
    
    private func hex2dec(hex : String) -> BInt {
        // Convertit un nombre en base 16 en un nombre en base 10
        
        let baseHex = "0123456789ABCDEF"
        var a = BInt(0)
        var c : BInt
        for i in 0...hex.count - 1 {
            c = BInt(index(lettre: hex[i], ref: baseHex))
            let b = hex.count - i - 1
            a += c * power(a : 16, b : b)
        }
        return a
    }
    
    
    private func index(lettre : Character, ref : String) -> Int {
        // Renvoie la place de la lettre dans la reférence donnée
        let index: Int = ref.distance(from: ref.startIndex, to: ref.range(of: String(lettre))!.lowerBound)
        return index
    }
    
    
    private func modifBase() {
        // Mdifie la base suivant les caractères cochés

        base = "";
        if (minState) {
            base += "portezcviuxwhskyajgblndqfm";
        }
        if (majState) {
            base += "THEQUICKBROWNFXJMPSVLAZYDG";
        }
        if (symState) {
            base += "@#&!)-%;<:*$+=/?>(";
        }
        if (chiState) {
            base += "567438921";
        }
    }
    
    
    private func modifSecurite() {
        // Modifie la sécurité en fonction des paramètres cochés
        longueurLabel.text = "Longueur : " + String(longueur)
        var bits = 0
        let nb_carac = base.count
        if !(minState || majState || symState || chiState) {
            securiteSlider.value = Float(bits)
        }
        else {
            bits = Int(round((log(pow(Double(nb_carac), Double(longueur)))/log(2.0))))
            securiteSlider.value = Float(bits - 32)
        }
        
        let result = securite(bits: bits)
        securiteLabel.text = result[0] as! String + String(bits) + " bits"
        securiteLabel.textColor = result[1] as? UIColor
        }
    
    
    private func modification(mot : String) -> Array<Any> {
        // Complexifie le mot de passe
        
        guard let data = mot.data(using: .utf8) else { return [0]}
        let digest = SHA256.hash(data: data)
        let chiffre = hex2dec(hex : digest.hexStr)
        let code2 = String(dec2base(x : chiffre, base: base).prefix(longueur))
        let nb_carac = base.count + 1
        let bits = Int(round((log(pow(Double(nb_carac),Double(longueur)))/log(2.0))))
        let result = securite(bits : bits)
    
        return [code2, result[0] as! String + String(bits) + " bits", bits , result[1] as! UIColor]
    }
    
    
    private func power(a : BInt, b : Int) -> BInt {
        // a ** b
        var result = BInt(1)
        if b == 0 {
        }
        else{
            for _ in 0...b-1 {
                result *= a
            }
        }
        return result
    }
    
    
    private func securite(bits : Int) -> Array<Any> {
        // Renvoie la bonne couleur ainsi que la sécurité suivant le nombre de bits
        
        let secure: String
        let color: UIColor
        
        if bits == 0 {
            secure = "Aucune "
            color = UIColor.red
        } else if bits < 64 {
            secure = "Très Faible "
            color = UIColor.red
        } else if bits < 80 {
            secure = "Faible "
            color = UIColor.red//(red: 1, green: 0.2, blue: 0.2, alpha: 1)
        } else if bits < 100 {
            secure = "Moyenne "
            color = UIColor.orange
        } else if bits < 128 {
            secure = "Forte "
            color = UIColor.green//(red: 0.2, green: 1, blue: 0.2, alpha: 1)
        } else {
            secure = "Très Forte "
            color = UIColor.green
        }
        return [secure, color]
    }

    
    // Mark : Actions
    
    @objc private func hideKeyboard() {
        // Cache le clavier
        clefTextField.resignFirstResponder()
        siteTextField.resignFirstResponder()
        motPasseTextField.resignFirstResponder()
    }
    
    
    @IBAction func clefChanged(_ sender: Any) {
        // Génère le mot de passe lorsque clef Text Field changé
        generer()
    }
    
    
    @IBAction func siteChanged(_ sender: Any) {
        // Génère le mot de passe lorsque site Text Field changé
        generer()
    }
    
    
    @IBAction func questionButtonPressed(_ sender: UIButton) {
        // Génère une alert box qui change la trace du Text Field clef lorsque questionButton est pressé
        
        // Create the alert
        let alert = UIAlertController(title: "Question personnelle", message: "Vous pouvez choisir entre coder avec une clef dont vous devez vous souvenir, ou entrer une information personnelle qui servira de clef.", preferredStyle: UIAlertController.Style.alert)

        // Add the actions (buttons)
        
        alert.addAction(UIAlertAction(title: "nom de jeune fille de votre mère", style: UIAlertAction.Style.default, handler: { action in self.clefTextField.placeholder = "nom jeune fille mère"
            self.clefTextField.text = ""
        }))
        alert.addAction(UIAlertAction(title: "nom de votre premier animal de compagnie", style: UIAlertAction.Style.default, handler: { action in self.clefTextField.placeholder = "nom premier animal de compagnie"
            self.clefTextField.text = ""
        }))
        alert.addAction(UIAlertAction(title: "rue de votre maison d'enfance", style: UIAlertAction.Style.default, handler: { action in self.clefTextField.placeholder = "rue maison enfance"
            self.clefTextField.text = ""
        }))
        
        alert.addAction(UIAlertAction(title: "pas de question", style: UIAlertAction.Style.default, handler: { action in self.clefTextField.placeholder = "mot clef"
            self.clefTextField.text = ""
        }))
        
        alert.addAction(UIAlertAction(title: "Annuler", style: UIAlertAction.Style.cancel, handler: nil))

        // Show the alert
        self.present(alert, animated: true, completion: nil)
    }

    
    @IBAction func infoAppPressed(_ sender: Any) {
        // Génère une alert box lorsque infoAppButton est pressé
        
        // Create the alert
        let mess = "     Cette application vous permet de générer des mots de passe, non pas aléatoirement, mais en fonction du nom du site où vous souhaitez vous connecter.\n\n     Par exemple, vous désirez changer le mot de passe de votre compte Google. Vous devez choisir entre une clef à se souvenir ou une question personnelle, puis entrer 'google' dans « nom du site », les caractères souhaités, la longueur du mot de passe, et le code sera généré.\n\n     Ensuite, pour le retrouver, vous n’avez qu’à reprendre l’application, toujours mettre 'google' dans nom du site, les mêmes informations, et vous obtiendrez le même mot de passe.\n\n     Attention, pour ne pas confondre les O et les zéros, il n'y a jamais de zéro dans les mots de passe générés.\n\n     Le bouton à côté du mot de passe généré sert à copier le mot de passe dans votre presse-papier.\n\n     Pour plus d'information sur la sécurité des mots de passe, vous pouvez consulter ce site :\n  * https://www.ssi.gouv.fr/administration/precautions-elementaires/calculer-la-force-dun-mot-de-passe/"
        let alert = UIAlertController(title: "Information", message: mess, preferredStyle: UIAlertController.Style.alert)

        // Add the actions (buttons)
        alert.addAction(UIAlertAction(title: "OK", style: UIAlertAction.Style.cancel, handler: nil))
        
        // Show the alert
        self.present(alert, animated: true, completion: nil)
    }
    
    
    @IBAction func copyButtonPressed(_ sender: Any) {
        // Copie le mot de passe lorsque copyButton est pressé
        if motPasseTextField.text == "                            " ||  motPasseTextField.text == "Il manque des valeurs" {
            showToast(message : "Aucun mot de passe à copier")
        }
        else {
           
            UIPasteboard.general.string = motPasseTextField.text
            showToast(message : "Mot de passe copié")
        }
    }
    
    
    @IBAction func sharePressed(_ sender: Any) {
        // Partage le mot de passe lorsque shareButton est pressé
        if motPasseTextField.text == "                            " ||  motPasseTextField.text == "Il manque des valeurs" {
            showToast(message : "Aucun mot de passe à partager")
        }
        else {
            let text = "Mon mot de passe pour " + siteTextField.text! + " est :\n" + motPasseTextField.text!
            text.share()
        }
    }
    
    
    @IBAction func minChanges(_ sender: Any) {
        // Minuscules Switch changé
        if minSwitch.isOn {
            minState = true
        }
        else {
            minState = false
        }
        generer()
    }
    
    
    @IBAction func majChanged(_ sender: Any) {
        // Majuscules Switch changé
        if majSwitch.isOn {
            majState = true
        }
        else {
            majState = false
        }
        generer()
    }
    
    
    @IBAction func symChanged(_ sender: Any) {
        // Symboles Switch changé
        if symSwitch.isOn {
            symState = true
        }
        else {
            symState = false
        }
        generer()
    }
    
    
    @IBAction func chiChanged(_ sender: Any) {
        // Chiffres Switch changé
        if chiSwitch.isOn {
            chiState = true
        }
        else {
            chiState = false
        }
        generer()
    }
   
    
    @IBAction func longueurSlider(_ sender: UISlider, forEvent event: UIEvent) {
 
        // Longueur Slider change
        let a = longueurSlider.value
        let len : Float
        if a <  0.75 {
            len = 0.0
        }
        else if a >= 0.75 && a <= 1.25 {
             len = 1.0
        }
        else {
            len = 2.0
        }
        longueur = Int(len * len + 3.0 * len + 10.0)
        longueurSlider.value = len
        longueurLabel.text = "Longueur : " + String(longueur)
        generer()
    }
    
    
    @IBAction func securiteSliderChanged(_ sender: Any) {
        // Sécurité Slider change
        let bits = securiteSlider.value + 32
        let len: Float
        
        if bits < 42 {
            len = 0.0
            minState = false
            majState = false
            symState = false
            chiState = true
        } else if bits < 47 {
            len = 0.0
            minState = false
            majState = false
            symState = true
            chiState = false
        } else if bits < 48 {
            len = 0.0
            minState = true
            majState = false
            symState = false
            chiState = false
        } else if bits < 51 {
            len = 0.0
            minState = false
            majState = false
            symState = true
            chiState = true
        } else if bits < 55 {
            len = 0.0
            minState = true
            majState = false
            symState = false
            chiState = true
        } else if bits < 57 {
            len = 0.0
            minState = true
            majState = false
            symState = true
            chiState = false
        } else if bits < 61 {
            len = 0.0
            minState = true
            majState = true
            symState = false
            chiState = false
        } else if bits < 63 {
            len = 0.0
            minState = true
            majState = true
            symState = true
            chiState = false
        } else if bits < 66 {
            len = 0.0
            minState = true
            majState = true
            symState = true
            chiState = true
        } else if bits < 67 {
            len = 1.0
            minState = true
            majState = false
            symState = false
            chiState = false
        } else if bits < 72 {
            len = 1.0
            minState = false
            majState = false
            symState = true
            chiState = true
        } else if bits < 76 {
            len = 1.0
            minState = true
            majState = false
            symState = false
            chiState = true
        } else if bits < 80 {
            len = 1.0
            minState = true
            majState = false
            symState = true
            chiState = false
        } else if bits < 86 {
            len = 1.0
            minState = true
            majState = true
            symState = false
            chiState = false
        } else if bits < 88 {
            len = 1.0
            minState = true
            majState = true
            symState = true
            chiState = false
        } else if bits < 94 {
            len = 1.0
            minState = true
            majState = true
            symState = true
            chiState = true
        } else if bits < 95 {
            len = 2.0
            minState = true
            majState = false
            symState = false
            chiState = false
        } else if bits < 103 {
            len = 2.0
            minState = false
            majState = false
            symState = true
            chiState = true
        } else if bits < 109 {
            len = 2.0
            minState = true
            majState = false
            symState = false
            chiState = true
        } else if bits < 114 {
            len = 2.0
            minState = true
            majState = false
            symState = true
            chiState = false
        } else if bits < 115 {
            len = 2.0
            minState = true
            majState = true
            symState = false
            chiState = false
        } else if bits < 123 {
            len = 2.0
            minState = true
            majState = false
            symState = true
            chiState = true
        } else if bits < 126 {
            len = 2.0
            minState = true
            majState = true
            symState = true
            chiState = false
        } else {
            len = 2.0
            minState = true
            majState = true
            symState = true
            chiState = true
        }
        minSwitch.isOn = minState
        majSwitch.isOn = majState
        symSwitch.isOn = symState
        chiSwitch.isOn = chiState
        longueurSlider.value = len
        longueur = Int(len * len + 3.0 * len + 10.0)
        generer()
    }
}

// MARK : Extension

extension ViewController: UITextFieldDelegate{
    // Enlève le clavier losque bouton retour est pressé
    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        textField.resignFirstResponder()
        return true
    }
}


extension ViewController{
    // Toast
    func showToast(message : String) {
        let toastLabel = UILabel(frame: CGRect(x: self.view.frame.size.width/2 - 125, y: self.view.frame.size.height-100, width: 250, height: 35))
        toastLabel.backgroundColor = UIColor.black.withAlphaComponent(0.6)
        toastLabel.textColor = UIColor.white
        toastLabel.textAlignment = .center;
        toastLabel.font = UIFont(name: "Montserrat-Light", size: 12.0)
        toastLabel.text = message
        toastLabel.alpha = 1.0
        toastLabel.layer.cornerRadius = 10;
        toastLabel.clipsToBounds  =  true
        self.view.addSubview(toastLabel)
        UIView.animate(withDuration: 4.0, delay: 0.1, options: .curveEaseOut, animations: {
            toastLabel.alpha = 0.0
        }, completion: {(isCompleted) in
            toastLabel.removeFromSuperview()
        })
    }
}


extension UIApplication {
    // Share
    class var topViewController: UIViewController? { return getTopViewController() }
    private class func getTopViewController(base: UIViewController? = UIApplication.shared.keyWindow?.rootViewController) -> UIViewController? {
        if let nav = base as? UINavigationController { return getTopViewController(base: nav.visibleViewController) }
        if let tab = base as? UITabBarController {
            if let selected = tab.selectedViewController { return getTopViewController(base: selected) }
        }
        if let presented = base?.presentedViewController { return getTopViewController(base: presented) }
        return base
    }
}


extension Hashable {
    // Share
    func share() {
        let activity = UIActivityViewController(activityItems: [self], applicationActivities: nil)
        UIApplication.topViewController?.present(activity, animated: true, completion: nil)
    }
}


extension Digest {
    var bytes: [UInt8] { Array(makeIterator()) }
    var data: Data { Data(bytes) }

    var hexStr: String {
        bytes.map { String(format: "%02X", $0) }.joined()
    }
}


extension String {
    subscript (index: Int) -> Character {
        let charIndex = self.index(self.startIndex, offsetBy: index)
        return self[charIndex]
    }

    subscript (range: Range<Int>) -> Substring {
        let startIndex = self.index(self.startIndex, offsetBy: range.startIndex)
        let stopIndex = self.index(self.startIndex, offsetBy: range.startIndex + range.count)
        return self[startIndex..<stopIndex]
    }
}

