# Test sur appareil

Étape 5 du plan. Le but : vérifier sur de vrais téléphones Android d'entrée de gamme que SOUKI est fluide, lisible et utilisable par tous, avant de coder l'app. On teste le prototype « SOUKI Android · Moments signature » (lien dans Avancement), ouvert dans Chrome.

## Pré-audit automatique (fait)

Prototype rejoué dans Chrome en émulation : écran 360 × 800, tactile, processeur ralenti 4 fois (ordre de grandeur d'un téléphone d'entrée de gamme). Ce n'est pas un vrai appareil : ces chiffres disent seulement qu'aucun moment n'est lourd par construction.

| Moment | Images par seconde | Images lentes (> 34 ms) |
|---|---|---|
| Intro « Le chemin du marché » | 60 | 0 sur 157 |
| Défilement de l'accueil | 57 | 1 sur 70 |
| Ajout rapide et vol vers le panier | 54 | 2 sur 55 |
| Carte vers fiche produit | 56 | 1 sur 52 |
| Retour | 60 | 0 sur 42 |
| Commande vocale « Du mot au panier » | 60 | 0 sur 226 |

Chargement de la page : environ 1 s avec le processeur ralenti.

Corrigé pendant le pré-audit :

- Les boutons « + » et « − » mesurent 40 dp à l'œil ; leur zone de toucher est portée à 48 dp, sans changer leur taille visible.
- Le bouton Partager de la fiche n'avait pas de libellé pour TalkBack : ajouté (en français et en arabe).
- Le bouton vide de la snackbar restait lisible par les lecteurs d'écran quand elle était cachée : masqué.

## Appareils

Au moins deux, au mieux quatre, dont un ancien :

| Appareil | Pourquoi |
|---|---|
| Samsung Galaxy A05 ou A15 | parmi les plus courants au Maroc |
| Xiaomi Redmi 12C ou 13C | écran et processeur modestes |
| Tecno ou Infinix d'entrée de gamme | surcouche Android très différente |
| Un téléphone sous Android 10 avec 3 Go de RAM | le plancher du brief |

Avant de commencer : batterie au-dessus de 30 %, économie d'énergie désactivée ; la réactiver pour la dernière tâche.

## Testeurs

Cinq personnes suffisent pour trouver l'essentiel des problèmes : une personne de plus de 60 ans peu à l'aise avec le numérique, une personne qui lit surtout l'arabe, un parent pressé, un étudiant, et si possible une personne qui utilise TalkBack ou une grande taille de texte. Ne pas aider pendant la tâche ; noter où la personne hésite.

## Les tâches

Donner la consigne à voix haute, sans montrer où toucher.

1. **Lancement** : ouvrir le lien et regarder l'intro. Question : « D'après vous, que fait SOUKI ? »
2. **Heure** : « Jusqu'à quelle heure pouvez-vous commander aujourd'hui ? »
3. **Ajout rapide** : « Ajoutez des pommes de terre au panier sans ouvrir leur fiche. »
4. **Fiche** : « Ouvrez les tomates et prenez-en 2 kg. »
5. **Retour** : « Revenez à l'accueil. » Observer : bouton retour, geste système ou glissement depuis le bord.
6. **Panier** : « Combien manque-t-il pour la livraison offerte ? », puis « Retirez un produit », puis « Annulez ce retrait ».
7. **Validation** : « Commandez pour demain 12h. »
8. **Commande vocale** : « Ajoutez votre liste en parlant. » Dans le prototype la voix est simulée : observer si la personne comprend la scène.
9. **Arabe** : dans le panneau, passer en العربية et refaire les tâches 3 et 6.
10. **Sombre et animations** : passer en sombre, puis activer « Supprimer les animations » dans les réglages d'Android, et relancer l'intro.

## Ce qu'on vérifie à chaque tâche

- **Fluidité** : saccades, retard au toucher, écran figé.
- **Lisibilité** : au moins une tâche en plein soleil, luminosité à 50 %.
- **Taille du texte** : Réglages › Affichage › Taille de police au maximum, puis Chrome › Accessibilité › Mise à l'échelle du texte à 200 %. Le prototype est une page web : il ne suit qu'une partie de ces réglages. Noter ce qui déborde.
- **TalkBack** : l'activer et faire les tâches 3 et 6. Chaque bouton doit annoncer une action (« Ajouter Tomates au panier »), jamais « bouton » seul.
- **Vibration** : la vibration à l'ajout au panier est-elle perçue, gênante ?

## Grille

Une ligne par tâche et par testeur.

| Testeur | Appareil | Tâche | Réussie (oui, avec aide, non) | Temps | Problème observé | Gravité (1 gêne, 2 bloque un moment, 3 bloque la tâche) | Capture ou vidéo |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

## Ce qu'il faut renvoyer

La grille remplie, les captures ou enregistrements d'écran des problèmes de gravité 2 et 3, et le modèle exact de chaque téléphone. Les problèmes sont ensuite classés, corrigés dans le design system et le prototype, et reportés dans la page Passation au code.
