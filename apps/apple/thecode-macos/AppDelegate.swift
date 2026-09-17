//
//  AppDelegate.swift
//  thecode-macos
//
//  Created by Juliette Debono on 29/09/2025.
//

import Cocoa

@main
class AppDelegate: NSObject, NSApplicationDelegate {

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Override point for customization after application launch.
    }

    /// Ouverture via le schéma `thecode://` (depuis l'extension AutoFill quand
    /// aucune clé n'est définie) : on amène simplement l'app au premier plan
    /// pour que l'utilisateur renseigne sa clé dans la vue principale.
    func application(_ application: NSApplication, open urls: [URL]) {
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }

}
