//
//  TheCodeApp.swift
//  thecode-extension-ios
//
//  Created by Juliette Debono on 27/09/2025.
//


import SwiftUI

let appGroupID = "group.fr.julsql.thecode.params"

@main
struct TheCodeApp: App {
    init() {
        initializeSharedDefaults()
    }
    
    var body: some Scene {
        WindowGroup {
            MainView()
        }
    }
}

func initializeSharedDefaults() {
    guard let defaults = UserDefaults(suiteName: appGroupID) else {
        print("❌ Impossible d'ouvrir UserDefaults avec \(appGroupID)")
        return
    }

    if defaults.string(forKey: "encodingKey") == nil {
        defaults.set("", forKey: "encodingKey")
    }
    if defaults.object(forKey: "lengthNumber") == nil {
        defaults.set(20, forKey: "lengthNumber")
    }
    if defaults.object(forKey: "minState") == nil {
        defaults.set(true, forKey: "minState")
    }
    if defaults.object(forKey: "majState") == nil {
        defaults.set(true, forKey: "majState")
    }
    if defaults.object(forKey: "symState") == nil {
        defaults.set(true, forKey: "symState")
    }
    if defaults.object(forKey: "chiState") == nil {
        defaults.set(true, forKey: "chiState")
    }

    defaults.synchronize()
}
