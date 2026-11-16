La scène de la commande vocale. Le cyan et le teal ne servent qu'ici.

- **Écoute** : orbe qui respire (1,6 s, la seule boucle de l'app), barres d'onde qui suivent le volume, durée sur 15 s (`VOICE_MAX_MS`).
- **Analyse** : la phrase est découpée par `buildVoiceSpans()` ; le groupe en cours est souligné en cyan (620 ms par groupe), le produit compris passe au centre, puis rejoint le plateau « Votre panier » ; le total roule.
- **Pas compris** : orbe éteinte, exemples, « Réessayer » et « Écrire ma liste ». Jamais d'erreur technique.
- Animations réduites : la liste apparaît directement, sans balayage.
- La scène reste sombre dans les deux thèmes ; texte `on-voice-surface`.
