//
//  ViewController.swift
//  TheCodeAppMac
//
//  Created by Jul SQL on 28/04/2020.
//  Copyright © 2020 Jul SQL. All rights reserved.
//

import Cocoa
import Foundation
import CryptoKit
import Darwin

class ViewController: NSViewController {
    
    // MARK : Outlets
    
    @IBOutlet weak var clefTextField: NSTextField!
    @IBOutlet weak var siteTextField: NSTextField!
    
    @IBOutlet weak var longueurLabel: NSTextField!
    @IBOutlet weak var longueurSlider: NSSlider!
    
    @IBOutlet weak var minSwitch: NSSwitch!
    @IBOutlet weak var majSwitch: NSSwitch!
    @IBOutlet weak var symSwitch: NSSwitch!
    @IBOutlet weak var chiSwitch: NSSwitch!
    
    @IBOutlet weak var genererButton: NSButton!
    @IBOutlet weak var motPasseTextField: NSTextField!
    
    @IBOutlet weak var securiteLabel: NSTextField!
    @IBOutlet weak var securiteSlider: NSSlider!
    
    @IBOutlet weak var clefButton: NSPopUpButton!
    @IBOutlet weak var questionButton: NSPopUpButton!
    @IBOutlet weak var clefLabel: NSTextField!
    
    
    override func viewDidLoad() {
        super.viewDidLoad()

        // Do any additional setup after loading the view.
        
        securiteLabel.stringValue = "Très Forte 129 bits"
        securiteLabel.textColor = NSColor(red: 0, green: 1, blue: 0, alpha: 1)
        questionButton.isHidden = true
        // genererButton.isHidden = true
    }
    
    // MARK : variables : initialisation
    var minState = true
    var majState = true
    var symState = true
    var chiState = true
    var base = ""
    var longueur = 20
    let question = ["Nom de jeune fille de votre mère", "Nom de votre premier animal de compagnie", "Rue de la maison de votre enfance"]
    var numquestion = 0

    // MARK : privates functions
    
    private func boolToInt(bool : Bool) -> Int{
        if bool {return 1}
        else {return 0}
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
          motPasseTextField.stringValue = "Il manque des valeurs"
          modifSecurite()
          if clefTextField.stringValue == "" || siteTextField.stringValue == "" {
              // Rien dans site ou dans clef
          }
          else if !(minState || majState || symState || chiState) {
              print("Rien n'est coché")
          }
          else {
            let result = modification(mot : siteTextField.stringValue + clefTextField.stringValue)
            motPasseTextField.stringValue = (result[0] as? String)!
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
           longueurLabel.stringValue = "Longueur : " + String(longueur)
           var bits = 0
           let nb_carac = base.count
        
           if !(minState || majState || symState || chiState) {
               securiteSlider.doubleValue = Double(bits)
           }
           else {
               bits = Int(round((log(pow(Double(nb_carac), Double(longueur)))/log(2.0))))
               securiteSlider.doubleValue = Double(bits - 32)
           }
           
        let result = securite(bits: bits)
        securiteLabel.stringValue = result[0] as! String + String(bits) + " bits"
        securiteLabel.textColor = result[1] as? NSColor
    }
    
    
    private func modification(mot : String) -> Array<Any> {
        // Complexifie le mot de passe
        
        guard let data = mot.data(using: .utf8) else { return [0]}
        let digest = SHA256.hash(data: data)
        let inter = hex2dec(hex : digest.hexStr)
        let code2 = String(dec2base(x : inter, base: base).prefix(longueur))
        let nb_carac = base.count + 1
        let bits = Int(round((log(pow(Double(nb_carac),Double(longueur)))/log(2.0))))
        let result = securite(bits : bits)
    
        return [code2, result[0] as! String + String(bits) + " bits", bits , result[1] as! NSColor]
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
        let color: NSColor
        
        if bits == 0 {
            secure = "Aucune "
            color = NSColor.red
        }
        else if bits < 64 {
            secure = "Très Faible "
            color = NSColor.red
        }
        else if bits < 80 {
            secure = "Faible "
            color = NSColor.red//(red: 1, green: 0.4, blue: 0.3, alpha: 1)
        }
        else if bits < 100 {
            secure = "Moyenne "
            color = NSColor.orange
        }
        else if bits < 128 {
            secure = "Forte "
            color = NSColor.green//(red: 0.6, green: 0.9, blue: 0.4, alpha: 1)
        }
        else {
            secure = "Très Forte "
            color = NSColor.green
        }
        return [secure, color]
    }
    
    
    // MARK : Actions
    
    @IBAction func clefTextViewChanged(_ sender: NSTextField) {
        // Génère le mot de passe lorsque clef Text Field est changé et supprime les caractères non désirés
        generer()
    }
    
    
    @IBAction func siteTextFieldChanged(_ sender: NSTextField) {
        // Génère le mot de passe lorsque site Text Field est changé et supprime les caractères non désirés
        generer()
    }
    
    
    @IBAction func motPasseTextFieldClick(_ sender: NSTextField) {
        // Génère le mot de passe lorsque motPasse Text Field est changé
        generer()
    }
    
    
    @IBAction func genererPressed(_ sender: NSButton) {
        // Codage lorsque genererButton est pressé
        generer()
    }
    
    
    @IBAction func questionButtonChanged(_ sender: Any) {
        numquestion = questionButton.indexOfSelectedItem
        clefTextField.placeholderString = question[numquestion]
        clefTextField.stringValue = ""
    }
    
    
    @IBAction func clefButtonChanged(_ sender: NSPopUpButton) {
        if clefButton.indexOfSelectedItem == 0 {
            questionButton.isHidden = true
            clefLabel.stringValue = "Clef :"
            clefTextField.placeholderString = "clef"
            clefTextField.stringValue = ""
        }
        else {
            questionButton.isHidden = false
            clefLabel.stringValue = "Clef :"
            clefTextField.placeholderString = question[numquestion]
            clefTextField.stringValue = ""
        }
    }
    
    
    @IBAction func minChanged(_ sender: NSSwitch) {
        // Minuscules Switch changé
        if minSwitch.integerValue == 1 {
            minState = true
        }
        else {
            minState = false
        }
        generer()
    }
    
    
    @IBAction func majChanged(_ sender: NSSwitch) {
        // Majuscules Switch changé
        if majSwitch.integerValue == 1 {
            majState = true
        }
        else {
            majState = false
        }
        generer()
    }
    
    
    @IBAction func symChanged(_ sender: NSSwitch) {
        // Symboles Switch changé
        if symSwitch.integerValue == 1 {
            symState = true
        }
        else {
            symState = false
        }
        generer()
    }
    
    
    @IBAction func chiChanged(_ sender: NSSwitch) {
        // Chiffres Switch changé
        if chiSwitch.integerValue == 1 {
            chiState = true
        }
        else {
            chiState = false
        }
        generer()
    }
    
    
    @IBAction func longueurSliderChanged(_ sender: NSSlider) {
        // Longueur Slider change
        let a = longueurSlider.doubleValue
        if a < 0.5 {
            longueurSlider.doubleValue = 0.0
            longueur = 10
            longueurLabel.stringValue = "Longueur : " + String(longueur)
        }
        else if (a > 0.5 || a == 0.5) && (a < 1.5 || a == 1.5) {
            longueurSlider.doubleValue = 1.0
            longueur = 14
            longueurLabel.stringValue = "Longueur : " + String(longueur)
        }
        else {
            longueurSlider.doubleValue = 2.0
            longueur = 20
            longueurLabel.stringValue = "Longueur : " + String(longueur)
        }
        generer()
    }
    
    
    @IBAction func securiteSliderChanged(_ sender: NSSlider) {
        // Sécurité Slider change
        let bits = securiteSlider.doubleValue + 32.0
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
        minSwitch.integerValue = boolToInt(bool: minState)
        majSwitch.integerValue = boolToInt(bool: majState)
        symSwitch.integerValue = boolToInt(bool: symState)
        chiSwitch.integerValue = boolToInt(bool: chiState)
        longueurSlider.floatValue = len
        longueur = Int(len * len + 3.0 * len + 10.0)
        generer()
    }
    
    
    override var representedObject: Any? {
        didSet {
        // Update the view, if already loaded.
        }
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
