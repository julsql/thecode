//
//  thecodeTests.swift
//  thecodeTests
//
//  Created by Juliette Debono on 29/09/2025.
//

import Testing
import SwiftUI
import Testing
@testable import TheCode

struct PasswordUtilsTests {
    
    // MARK: - generatePassword
    @Test
    func testGeneratePasswordAllOptions() async throws {
        var utils: PasswordUtils {
            let u = PasswordUtils()
            u.minState = true
            u.majState = true
            u.symState = true
            u.chiState = true
            u.longueur = 20
            return u
        }
        
        let result = utils.generatePassword(input: "siteclef")
        
        #expect(result.code.count == 20)
        #expect(result.code == "u8YfpdVdK*#Bpy6(9f*5")
        
        #expect(result.label == "Très Forte")
        #expect(result.color == .green)
        #expect(result.bits > 0)
        
        // Vérifie qu’au moins un char de chaque groupe apparaît
        let groups = [
            "portezcviuxwhskyajgblndqfm",
            "THEQUICKBROWNFXJMPSVLAZYDG",
            "@#&!)-%;<:*$+=/?>(",
            "567438921"
        ]
        
        for g in groups {
            #expect(result.code.contains(where: { g.contains($0) }))
        }
    }
    
    // MARK: - buildCharset
    @Test
    func testBuildCharset() {
        var utils1: PasswordUtils {
            let u = PasswordUtils()
            u.minState = true
            u.majState = true
            u.symState = true
            u.chiState = true
            u.longueur = 20
            return u
        }
        
        let all = utils1.buildCharset()
        #expect(all == [
            "portezcviuxwhskyajgblndqfm",
            "THEQUICKBROWNFXJMPSVLAZYDG",
            "@#&!)-%;<:*$+=/?>(",
            "567438921"
        ])
        
        var utils2: PasswordUtils {
            let u = PasswordUtils()
            u.minState = true
            u.majState = false
            u.symState = true
            u.chiState = false
            u.longueur = 20
            return u
        }
        let some = utils2.buildCharset()
        #expect(some == [
            "portezcviuxwhskyajgblndqfm",
            "@#&!)-%;<:*$+=/?>("
        ])
        
        var utils3: PasswordUtils {
            let u = PasswordUtils()
            u.minState = false
            u.majState = false
            u.symState = false
            u.chiState = false
            u.longueur = 20
            return u
        }
        let none = utils3.buildCharset()
        #expect(none.isEmpty)
    }
    
    // MARK: - calculateEntropyBits
    @Test
    func testCalculateEntropyBits() {
        var utils: PasswordUtils {
            let u = PasswordUtils()
            u.minState = true
            u.majState = true
            u.symState = true
            u.chiState = true
            u.longueur = 20
            return u
        }
        
        let totalBase = [
            "portezcviuxwhskyajgblndqfm",
            "THEQUICKBROWNFXJMPSVLAZYDG",
            "@#&!)-%;<:*$+=/?>(",
            "567438921"
        ]
        
        #expect(utils.calculateEntropyBits(groups: totalBase, length: 20) == 126)
        #expect(utils.calculateEntropyBits(groups: totalBase, length: 10) == 63)
    }
    
    // MARK: - getSecurityLevel
    @Test
    func testGetSecurityLevel() {
        
        var utils: PasswordUtils {
            let u = PasswordUtils()
            u.minState = true
            u.majState = true
            u.symState = true
            u.chiState = true
            u.longueur = 20
            return u
        }
        let (label1, color1) = utils.getSecurityLevel(bits: 126)
        
        #expect(label1 == "Très Forte")
        #expect(color1 == .green)
        
        let (label2, color2) = utils.getSecurityLevel(bits: 63)
        #expect(label2 == "Très Faible")
        #expect(color2 == .red)
        
        let (label3, color3) = utils.getSecurityLevel(bits: 0)
        #expect(label3 == "Aucune")
        #expect(color3 == .red)
    }
    
    // MARK: - convertToBase
    @Test
    func testConvertToBase() {
        let utils = PasswordUtils()
        
        #expect(utils.convertToBase(seed: 1, charset: "abc") == "b")
        #expect(utils.convertToBase(seed: 0, charset: "abc") == "a")
        #expect(utils.convertToBase(seed: 2, charset: "01") == "00")
    }
    
    // MARK: - applyCharsetReplacement
    @Test
    func testApplyCharsetReplacement() throws {
        let utils = PasswordUtils()
        let seed = BInt(123456789)
        let groups = ["abc", "XYZ", "123"]
        let password = String(repeating: "a", count: 9)
        
        // Utiliser try pour appeler la fonction qui peut throw
        let result = try utils.applyCharsetReplacement(
            seed: seed,
            password: password,
            charsetGroups: groups
        )
        
        #expect(result.count == 9)
        
        for g in groups {
            #expect(result.contains { g.contains($0) })
        }
    }
    
    @Test
    func testApplyCharsetReplacementTooShort() {
        var utils: PasswordUtils {
            let u = PasswordUtils()
            u.minState = true
            u.majState = true
            u.symState = true
            u.chiState = true
            u.longueur = 20
            return u
        }
        let seed = BInt(1)
        let groups = ["abc", "XYZ", "123"]
        let password = "ab"
        
        #expect(throws: PasswordError.passwordTooShort(min: groups.count)) {
                _ = try utils.applyCharsetReplacement(
                    seed: seed,
                    password: password,
                    charsetGroups: groups
                )
            }
    }
    
    // MARK: - getUniquePosition
    @Test
    func testGetUniquePosition() {
        
        var utils: PasswordUtils {
            let u = PasswordUtils()
            u.minState = true
            u.majState = true
            u.symState = true
            u.chiState = true
            u.longueur = 20
            return u
        }
        let pos = utils.getUniquePosition(
            seed: BInt(5),
            used: [0, 1, 2],
            length: 5
        )
        
        #expect(pos >= 0 && pos < 5)
        #expect(![0, 1, 2].contains(pos))
        
        let pos2 = utils.getUniquePosition(
            seed: BInt(3),
            used: [0, 1, 2, 3],
            length: 5
        )
        
        #expect(pos2 == 4)
    }
    
    // MARK: - hashToBigInt
    @Test
    func testHashToBigInt() async throws {
        var utils: PasswordUtils {
            let u = PasswordUtils()
            u.minState = true
            u.majState = true
            u.symState = true
            u.chiState = true
            u.longueur = 20
            return u
        }
        let input = "test"
        let expectedHex =
        "9f86d081884c7d659a2feaa0c55ad015" +
        "a3bf4f1b2b0b822cd15d6c15b0f00a08"
        
        let expectedBigInt = BInt(expectedHex, radix: 16)
        
        let result = utils.hashToBInt(input)
        
        #expect(result == expectedBigInt)
        
        let h1 = utils.hashToBInt("hello")
        let h2 = utils.hashToBInt("world")
        #expect(h1 != h2)
    }
}
