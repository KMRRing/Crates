# Setup for Together mode (once)
Together mode and synced runs use the same Firebase project as CroatiaQuiz (croatiabio). Its database rules need the `crates` block (game rooms and synced runs):
Firebase console → Realtime Database → Rules → replace with the contents of `firebase-rules.json` → Publish.
