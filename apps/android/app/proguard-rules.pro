# Default ProGuard rules
-keepattributes Signature
-keepattributes *Annotation*
-keep class fr.juliette.thecode.** { *; }

# Credential Manager charge son fournisseur Play Services par réflexion.
-if class androidx.credentials.CredentialManager
-keep class androidx.credentials.playservices.** { *; }
