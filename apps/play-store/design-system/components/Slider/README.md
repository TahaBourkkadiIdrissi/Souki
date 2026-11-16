Le curseur sert au budget du panier intelligent : de 50 à 500 DH, par pas de 10 DH.

- Piste `motion-track`, partie active et poignée `primary` ; halo `primary-container` au repos, plus large quand le doigt tient la poignée.
- Tenu au doigt : une bulle `inverse-surface` montre la valeur au-dessus du pouce, la valeur à droite du titre suit en même temps. Retour haptique `SEGMENT_TICK` à chaque pas de 10 DH.
- Bornes affichées sous la piste, en chiffres tabulaires. La valeur reste toujours lisible en texte : le curseur ne dit jamais seul combien.
- Désactivé : piste et poignée à 38 % d'opacité, aucune bulle.
- En arabe, la piste se remplit de droite à gauche ; les montants restent écrits de gauche à droite.
- Bornes à confirmer avec le back-end (le code n'a qu'une valeur par défaut, 150 DH).
- TalkBack : « Budget, 150 dirhams, curseur. Balayer vers le haut ou le bas pour ajuster. »
- React Native : `Slider` de `@expo/ui` (Compose), `step` 10.
