# Plan de lancement rentable de Souki

Version de travail du 5 octobre 2026. Ce document propose des décisions à discuter ; il ne modifie ni les prix du site, ni ses conditions, ni les brochures Canva.

## Décision proposée

Lancer un service de courses fraîches simple et fiable dans un seul quartier de Fès, avec un panier découverte conseillé et un catalogue libre limité. Fonctionnement retenu : précommandes des particuliers, achat des caisses nécessaires, préparation et livraison quotidienne, puis écoulement du surplus auprès de B2B, sans stock permanent prévu. Calculer le résultat combiné des ventes aux particuliers et aux B2B avant de financer une promotion. Mesurer les premières commandes livrées et payées, puis les nouvelles commandes aux conditions normales.

L'offre initiale repose sur la commodité, le choix des produits, la clarté du total et le traitement des problèmes. Aucune réduction générale ni première livraison gratuite sur tout le catalogue. Un cadeau ou une livraison offerte pourra être testé sur une composition déterminée après validation de son coût.

## Sources et niveau de confiance

- Informations du fondateur : aucun client livré à ce jour ; budget marketing faible, prévu essentiellement pour les brochures et enveloppes ; livraison payée au livreur 10 DH ; carton 5 DH ; frais actuellement envisagés pour le client 15 DH ; exemple approximatif de pommes de terre à 200 DH pour 32 kg. Contraintes confirmées : achat par caisses entières et livraison chaque jour dès le lancement.
- Précision du fondateur : pas de stock permanent ; les achats suivent les précommandes, les surplus éventuels sont destinés à être liquidés auprès de B2B. Les prix de reprise, capacités et délais d'encaissement B2B ne sont pas encore renseignés dans ce plan.
- Dernière précision : aucun repreneur ni accord B2B n'est établi à ce stade. Le B2B est un débouché envisagé, pas une recette sécurisée. Ne pas financer une offre commerciale sur ces recettes supposées.
- Business plan fourni : `C:/Users/PC/Downloads/BP_VF (1).docx`. Ses prix, pertes de 10 %, porteur à 4 DH/caisse et frais de paiement de 2 % sont des hypothèses, pas des dépenses actuelles vérifiées.
- Document de pricing : `Documentation/pricing_strategy (1).md`. Il contient des projections et calculs à corriger, pas des résultats observés.
- Code examiné : la majoration et le coussin sont appliqués au prix de gros ; les frais de livraison sont de 15 DH, le seuil gratuit de 300 DH, le minimum de produits de 50 DH ; une connexion est requise avant l'ajout au panier.
- Compétences utilisées : Pricing, Offers, Marketing Psychology et CRO. Leurs recommandations générales sont adaptées à la vente de produits frais ; leurs exemples SaaS et promesses de gains ne servent pas de prévisions pour Souki.

## 1. Remplacer les promesses non démontrées

Le BP cible les étudiants et jeunes salariés ; la campagne actuelle cible les personnes qui gèrent les courses des foyers de quartiers aisés. Le plan doit suivre cette nouvelle cible sans supposer qu'elle accepte n'importe quel prix.

Promesse proposée : « Vos produits frais, choisis avec soin et livrés à votre porte. » Le temps gagné, la commodité et la confiance sont des hypothèses de motivation à vérifier auprès des premiers clients.

Retirer des hypothèses commerciales : être systématiquement moins cher que tous les marchands, zéro invendu garanti, CAC négatif, bénéfice net garanti, seuil de rentabilité universel à sept commandes par jour. Un volume de sept commandes ne garantit ni l'écoulement de chaque caisse ni la couverture de toutes les charges.

Ne pas présenter un prix de concurrent déduit d'un coefficient comme un relevé réel. Ne pas appeler une livraison « offerte » si son coût a simplement été ajouté au prix annoncé ; un prix global peut être présenté comme « livraison incluse ».

## 2. Clarifier les coûts et les marges

### Calcul par produit

Coût du kg utilisable = (prix de la caisse + porteur + transport d'achat affecté + autres frais d'achat non récupérables) / poids utilisable.

Le poids utilisable exclut la tare et les produits réellement écartés. Pour une simulation avant achat, tester plusieurs taux de perte ; après achat, utiliser les pesées. Ne pas compter deux fois la même perte.

La précommande donne la quantité à livrer aux particuliers. L'achat en caisses entières peut créer un surplus destiné au B2B. Suivre distinctement achats, ventes aux particuliers, ventes B2B, écarts de tri et éventuel reliquat en fin de journée. Le modèle ne prévoit pas de conserver un stock permanent ; le coût et les recettes du surplus doivent néanmoins entrer dans le résultat du lot.

Contribution produit = prix de vente - coût réel affecté au produit.

Taux de marge sur vente = contribution produit / prix de vente.

Pour viser un taux de marge sur vente g : prix théorique = coût réel / (1 - g). Ce résultat est un point de calcul, à confronter à l'acceptabilité du prix et aux alternatives réelles.

Le champ actuel `marge_cible` de l'application est une majoration appliquée au prix de gros. Par exemple, sans coussin, +20 % sur un coût de 10 DH donne un prix de 12 DH et une marge sur vente de 16,67 %. Ne pas transformer les paramètres de l'admin en taux de marge nette.

### Exemple pommes de terre

Hypothèses : 200 DH pour 32 kg de pommes de terre hors tare ; porteur de 4 DH issu du BP ; aucun autre frais d'achat ajouté ici. Les 10 % de pertes sont un scénario prudent du BP, pas une mesure.

| Pertes physiques supposées | Quantité utilisable | Coût par kg utilisable |
|---|---:|---:|
| 0 % | 32,0 kg | 6,38 DH |
| 5 % | 30,4 kg | 6,71 DH |
| 10 % | 28,8 kg | 7,08 DH |

Dans le scénario à 10 %, une vente à 6,40 DH perd environ 0,68 DH/kg avant les coûts de commande. À 8 DH, elle apporte environ 0,92 DH/kg, soit 11,46 % du prix de vente. Le prix de 8 DH est une illustration arithmétique, pas un tarif validé pour le lancement.

En remplaçant uniquement le coût des 5 kg de pommes de terre du panier du BP par ce nouveau scénario, le coût des marchandises passe de 165,22 à 172,29 DH. Aux anciens prix de vente, le panier de produits de 191 DH ne contribue plus que 18,71 DH lorsque les 15 DH de frais couvrent livreur et carton. Offrir la livraison laisserait 3,71 DH avant les autres dépenses. Tous les autres coûts et prix restent artificiellement constants dans cette sensibilité.

### Calcul par commande

Contribution de commande = recettes produits + frais client - coût produits - livreur - cartons - frais de paiement - avantage offert - autres coûts variables.

Pour un carton et une livraison réussie : 15 DH encaissés - 10 DH livreur - 5 DH carton = 0 DH. Les 5 DH conservés après paiement du livreur financent le carton.

Comptabiliser un éventuel deuxième carton, le transport du marché au local, le temps de préparation, les incidents, les paiements et les pertes non déjà incluses. La contribution restante finance ensuite les frais fixes, le marketing et la rémunération non déjà comptée. Elle n'est pas un bénéfice net.

La trésorerie d'achat doit être calculée séparément selon les dates de paiement : 10 kg de pommes de terre précommandés à 8 DH/kg représentent 80 DH de recettes, face à une caisse à payer 204 DH. Les 18,8 kg utilisables restants, dans le scénario à 10 % de pertes, sont destinés au B2B. Le besoin d'avance dépend de l'encaissement effectif des deux canaux et du paiement du fournisseur. Précommande ne signifie pas nécessairement prépaiement. Les 124 DH d'écart ne sont pas automatiquement une perte.

Le calcul par commande doit être rapproché du résultat de tous les lots achetés : une contribution positive sur les particuliers peut être réduite par une liquidation B2B sous le coût affecté au surplus. Ne pas compter deux fois le coût de ce surplus ou les mêmes pertes.

## 3. Refaire les règles de prix

Conserver les trois niveaux comme outil interne, sans imposer un pourcentage fictif de chaque niveau dans tous les paniers.

- Niveau 1 : quelques produits essentiels compétitifs, avec contribution positive après frais d'achat et pertes. Ne pas faire du zéro de marge une règle permanente.
- Niveaux 2 et 3 : marges calculées sur le prix de vente et le coût réel. Les 15–32 % annoncés restent à mesurer et ne sont pas des résultats acquis.
- Tester au minimum un panier dominé par les essentiels, le panier découverte, un panier mixte et un panier juste au seuil gratuit. Recalculer avec achats plus chers et pertes plus élevées.
- Le garde-fou théorique « coût × 1,12 » plafonnerait la marge sur vente à 10,71 %. Il est incompatible avec une cible de 15–32 % si les deux s'appliquent au même coût. Utiliser des relevés concurrents réels comme information, pas une réduction automatique qui vend à perte.
- Une progression vers un seuil gratuit n'améliore la contribution que si la marge supplémentaire couvre les frais abandonnés. Un minimum de 50 DH ou un panier de 300 DH ne suffit pas à garantir cela.
- Ne pas augmenter rétroactivement le prix d'une commande confirmée après les achats du matin. Une hausse affecte les commandes suivantes ; toute substitution ou modification du panier est acceptée par le client.

### Frais de lancement proposés

Conserver 15 DH pour une livraison standard avec un carton. Afficher les frais et le total avant la validation. Vérifier poids, nombre de cartons, zone et coût d'une seconde présentation avec le livreur.

Recalculer la gratuité actuelle dès 300 DH avant la campagne. Proposition si aucune marge minimale fiable ne peut la financer : suspendre cette gratuité générale avant lancement, et réserver tout avantage futur à une composition explicitement définie. Cette modification exige une décision du fondateur puis un alignement du code, du site, des FAQ et des brochures ; elle n'est pas appliquée par ce document.

## 4. Offre de première commande

### Recommandation pour les prospects de la brochure

Recommandation affinée après demande du fondateur d'explorer au-delà des promotions classiques : présenter « Le marché à votre porte », avec une première commande accompagnée en option. Le prospect peut choisir directement un panier conseillé ajustable, ou demander une proposition selon son budget total livré et les produits qu'il souhaite éviter. Souki confirme les produits, quantités et total avant toute commande ; aucune commande ou substitution n'est imposée. Le catalogue libre reste accessible. Ne pas annoncer de réduction, de livraison gratuite ou de crédit de bienvenue lors du premier test.

Le bénéfice concret est de déléguer les courses tout en gardant le contrôle du choix et de la dépense. La meilleure hypothèse de lancement à tester est une aide au choix et un traitement fiable des problèmes ; aucun résultat ne permet encore de la déclarer supérieure en conversion à toutes les promotions.

### Accompagnement de la première commande

- Afficher d'abord un panier et son prix livré : ne pas imposer un questionnaire ou une conversation à tous les visiteurs. Une aide humaine facultative permet une proposition adaptée, sans supplément au lancement ; ne pas lui inventer une valeur barrée.
- Limiter cette aide à la sélection et aux quantités parmi les références proposées, dans un budget réaliste incluant les frais et respectant le minimum de commande. Pas de promesse de recherche illimitée de produits ou de conseil nutritionnel.
- Tester manuellement cet accompagnement sur un petit nombre de commandes, selon la capacité réelle, avant d'automatiser. Chronométrer le temps consacré : l'absence de remise n'en fait pas une prestation sans coût. Intégrer ce temps à la contribution de commande.
- Confirmer le contenu, le prix total et la date de livraison. Photographier une préparation réelle pour présenter honnêtement le service ; une photo envoyée pour chaque commande n'est pas nécessaire au lancement.
- Prévoir un remboursement de l'article abîmé ou manquant après vérification simple, avec des conditions et un moyen de remboursement opérationnels avant publicité. La qualité de base et le traitement des incidents valent pour tous les clients, pas seulement leur première commande.
- Après une livraison réussie, proposer de reprendre le même panier en l'adaptant ; les prix actualisés sont présentés avant confirmation. Pas d'abonnement ni de commande récurrente automatique. Réserver le parrainage à cette étape.

Comparer au cours du pilote le coût de l'accompagnement, les commandes effectivement livrées et les retours clients. Avec un faible volume, ces observations guident les ajustements sans prouver un effet causal ou une supériorité statistique. Si cette aide coûte trop de temps ou est peu demandée, conserver la sélection conseillée et simplifier le service.

| Option | Décision proposée au lancement | Motif |
|---|---|---|
| Code de parrainage en accroche principale | Non | Le prospect reçoit une publicité ; il n'a pas encore vécu une recommandation d'un proche. Le crédit existant arrive après livraison et ne réduit pas la première facture. |
| Réduction générale ou première livraison offerte | Non pour le premier test | La contribution réelle et la reprise B2B ne sont pas validées. À 150 DH de produits, une remise de 10 % coûte 15 DH de recettes. |
| Panier conseillé + total clair + traitement concret d'un problème | Oui | Réduit les choix à faire et l'incertitude sur la première commande, tout en permettant de tester la demande au prix normal. |
| Petit cadeau à coût plafonné | Test ultérieur possible | À financer par la contribution mesurée ; aucun coût ni minimum de panier n'est validé maintenant. |

Le code local `back-end/services/parrainage_service.py` prévoit 3 DH de crédit wallet pour le parrain et 3 DH pour le filleul, déclenchés au passage à LIVRE sous les conditions du programme : 6 DH de crédits nominaux par parrainage converti. Ce sont des crédits à utiliser ensuite, pas une réduction immédiate sur la première commande ni nécessairement 6 DH de décaissement immédiat. Vérifier le fonctionnement complet avant d'en faire la publicité. Réserver la mise en avant du parrainage à un client satisfait après sa livraison ; ne pas augmenter les montants maintenant.

Éléments proposés pour l'offre : une photo réelle, un panier facile à ajuster, des frais standard de 15 DH visibles, une date de livraison annoncée, un contact joignable et une procédure de remboursement de l'article abîmé ou manquant après vérification simple. Cette dernière proposition doit être opérationnelle et ses conditions définies avant publication ; ne pas publier une garantie générale « satisfait ou remboursé ».

Texte de travail pour la brochure : « Vos courses fraîches, sans le déplacement au marché. » Puis : « Découvrez notre panier conseillé ou composez le vôtre. » CTA : « Voir les produits et le prix livré ». Donner une raison concrète de commander avec la prochaine livraison disponible et son heure limite réelle, sans fausse urgence.

Pour diagnostiquer le pilote : peu de scans invite à revoir la distribution et l'accroche ; des visites sans panier invitent à examiner l'offre, les prix et la confiance ; des paniers sans commande invitent à vérifier les frais, l'identification, le paiement et la livraison ; une première commande sans réachat invite à interroger qualité, service et fréquence des besoins. Ce sont des pistes de diagnostic à corroborer par les retours clients, pas des causes démontrées par un petit échantillon. Aucun de ces signaux ne justifie automatiquement une remise.

### Offre de base à tester

Un seul panier découverte recommandé : produits usuels, quantités affichées, photographie du carton réellement préparé, contenu et total détaillés. Le catalogue libre reste accessible. Concevoir une taille facile à essayer ; le panier de 22,5 kg du BP ne doit pas devenir le panier d'essai par défaut sans retour client.

Le prix et la composition exacts seront calculés après relevé fournisseur. Si le panier reprend les articles du catalogue, son total doit correspondre à ces articles et aux frais affichés, hors avantage explicite. Les modifications par le client mettent le total à jour.

CTA : « Voir le panier et son prix livré ». Réassurance : paiement à la livraison lorsqu'il est réellement opérationnel, dates disponibles et moyen de contact visibles. L'horaire de livraison annoncé correspond à la tournée réalisable, pas à une heure exacte non maîtrisée.

### Cadeau éventuel, après calcul

Un petit produit nommé peut être inclus dans une version déterminée du panier découverte, une fois par foyer pour une première commande livrée et payée. Son coût d'achat, ses pertes et son conditionnement sont intégrés à l'offre. Aucun faux cadeau obtenu en augmentant artificiellement les autres prix.

Garde-fou de travail proposé : viser au moins 20 DH de contribution restante sur le panier découverte après les coûts variables et le cadeau. Ce montant n'est ni un seuil de rentabilité démontré, ni une garantie de couverture du marketing. Il sera revu avec le coût d'acquisition et le temps de préparation.

Si le panier ne finance pas l'avantage, lancer sans cadeau. Ne pas promettre un cadeau à tous puis l'enlever selon une marge invisible au client.

### Sensibilité illustrative

Panier de produits à 150 DH ; un livreur à 10 DH et un carton à 5 DH. Hypothèse supplémentaire de travail : 5 DH par commande pour préparation/incidents, à mesurer et remplacer par les coûts correspondants ; ce n'est pas une dépense constatée. Aucun frais de paiement ni coût marketing n'est inclus dans le tableau.

| Marge produits sur vente | Avec 15 DH de frais client | Avec les mêmes frais et cadeau coûtant 2 DH | Livraison offerte sans cadeau |
|---|---:|---:|---:|
| 8 % | 7,00 DH | 5,00 DH | -8,00 DH |
| 15 % | 17,50 DH | 15,50 DH | 2,50 DH |
| 22 % | 28,00 DH | 26,00 DH | 13,00 DH |

La composition du panier compte autant que son montant. Le tableau ne permet pas de conclure qu'un cadeau est toujours finançable.

## 5. Donner confiance et permettre le réachat

Proposition de traitement d'un problème : un article manquant ou arrivé abîmé peut faire l'objet d'un signalement simple ; après vérification rapide, proposer le remboursement de l'article concerné ou un remplacement convenu. Définir le canal, le délai de traitement et le moyen de remboursement avant d'en faire une promesse. Un avoir wallet peut être une option acceptée, pas un mécanisme pour forcer le retour. Ce sont des choix de service proposés, pas une description juridique des droits du client.

Après la première livraison : demander un retour de qualité par le canal convenu ; régler tout incident avant une sollicitation commerciale ; rendre la reprise du dernier panier facile. Un rappel de courses est facultatif et consenti. Aucun message n'est envoyé dans le cadre de ce plan.

Reporter les abonnements, bonus de recharge et primes de parrainage importantes jusqu'à des commandes répétées à marge connue. Ne pas considérer les soldes prépayés comme du bénéfice : ils correspondent à des produits encore à fournir.

## 6. Précommandes, caisses entières et écoulement B2B

Le fonctionnement retenu ne prévoit pas de stock permanent. Chaque jour : clôturer les précommandes, calculer les besoins par produit, acheter les caisses nécessaires, trier et préparer, livrer les particuliers et écouler le surplus auprès des B2B. La précommande réduit l'incertitude sur la demande des particuliers ; le canal B2B complète l'écoulement des caisses.

### Organisation proposée

- Commencer dans un quartier avec une tournée quotidienne annoncée. Fixer l'heure limite des précommandes selon l'approvisionnement et la préparation réellement possibles.
- Examiner 8 à 12 références candidates et retenir un assortiment cohérent avec les besoins des particuliers et la capacité de reprise B2B. Le panier découverte concentre la demande sur ces références ; le choix libre reste possible.
- Calculer les caisses nécessaires à partir des quantités précommandées et d'un rendement utilisable prudent. Peser les lots : le poids d'une caisse et les écarts de tri ne sont pas nécessairement constants.
- Pour chaque produit, noter les kilos destinés aux particuliers et le surplus estimé à proposer au B2B. Clarifier avec les repreneurs les produits et qualités acceptés, les volumes, le prix ou sa règle de calcul, l'enlèvement ou le transport, ainsi que le délai de paiement.
- Le B2B fait partie du modèle retenu. Tant que ses conditions ne sont pas renseignées, distinguer ses recettes estimées des recettes convenues et encaissées ; ne pas supposer un rachat illimité à un prix couvrant forcément le coût.
- Suivre par lot : achat, poids net, écarts de tri, ventes aux particuliers, ventes B2B, recettes de chaque canal, coût de cession B2B et éventuel reliquat. Ne pas affecter automatiquement 10 % de pertes si le surplus est vendu : pertes physiques et vente à prix réduit sont deux choses différentes.
- Vérifier que les 10 DH du livreur s'appliquent aussi à une seule commande. Prévoir également le transport du marché, la préparation et l'acheminement du surplus si les B2B ne l'enlèvent pas.

### Calcul combiné particuliers + B2B

Contribution du lot avant les autres coûts de commande = recettes produits particuliers + recettes B2B - coût total du lot acheté - frais propres à la cession B2B.

Illustration, sans prévision des prix B2B : caisse à 204 DH avec porteur ; 28,8 kg utilisables si 10 % sont réellement écartés ; 20 kg précommandés à 8 DH/kg, soit 160 DH ; surplus de 8,8 kg intégralement vendu aux B2B.

| Prix B2B hypothétique | Recettes B2B | Recettes produits totales | Reste après achat et porteur, avant autres coûts |
|---|---:|---:|---:|
| 4 DH/kg | 35,20 DH | 195,20 DH | -8,80 DH |
| 5 DH/kg | 44,00 DH | 204,00 DH | 0,00 DH |
| 6 DH/kg | 52,80 DH | 212,80 DH | +8,80 DH |

Dans les trois cas tout le volume utilisable est vendu. Le prix B2B détermine néanmoins ce qui reste pour les autres dépenses. Les 5 DH/kg équilibrent uniquement achat et porteur dans cet exemple, avec zéro frais de cession B2B. Le tableau n'est ni un devis de reprise ni un seuil de rentabilité complet.

Le résultat doit être observé par produit et pour la journée entière, puis rapproché des frais clients, du livreur, des cartons, de la préparation et des autres dépenses. Financer une offre de bienvenue sur cette contribution combinée, sans supposer que le surplus est gratuit ou sans coût d'écoulement.

### Trésorerie et limites du pilote

Préparer un calendrier quotidien des décaissements et encaissements des deux canaux. Même sans stock permanent, un paiement fournisseur antérieur à l'encaissement des clients peut nécessiter une avance. Son montant dépend des conditions de paiement réelles ; il ne correspond pas automatiquement à un budget de stockage.

Définir une perte maximale acceptable pour le test. Simuler une reprise B2B au prix attendu, au prix bas et une reprise partielle avant de fixer le budget promotionnel. Une difficulté ponctuelle de reprise appelle une solution explicite pour le reliquat et son coût ; elle ne transforme pas le modèle de base en stockage permanent.

Si certains lots restent déficitaires après les ventes aux deux canaux, revoir pour les commandes suivantes leur prix, l'assortiment ou les conditions de reprise. Honorer les commandes déjà confirmées aux conditions acceptées.

## 7. Brochure et page d'arrivée

Enveloppe : « Et si le marché venait à votre porte ? » avec SOUKI identifiable.

Brochure A4 : conserver une direction élégante et peu de texte. Photographier le carton et les produits réels. Ne pas laisser croire que le panier en osier des maquettes est fourni. Mettre en avant le service, le panier découverte et un seul CTA. Éviter les prix variables imprimés avant validation ; ils restent actualisables sur la page d'arrivée.

Le QR pointe vers une adresse stable Souki dédiée à la campagne, avec un identifiant de vague sans donnée personnelle. La page affiche le même message, la sélection, les quantités, le prix total et les prochaines livraisons disponibles. Un contact d'aide est secondaire.

Avant campagne : permettre de composer un panier avant connexion, préserver ce panier lors de l'identification, présenter les frais tôt et vérifier le parcours mobile complet jusqu'à la commande confirmée. Il s'agit de travaux à planifier, pas de fonctions promises comme déjà disponibles.

## 8. Pilote et critères de poursuite

1. Relever les coûts de 8 à 12 produits candidats, les conditions de reprise B2B, peser un achat réel et obtenir un devis brochure/enveloppe. Noter le temps d'achat et de préparation. Calculer l'éventuelle avance d'achat et séparer les budgets emballages, livreur et impression.
2. Construire un panier découverte et tester les scénarios défavorables. Arrêter son prix, ses conditions et le traitement d'un incident avant de publier l'offre.
3. Préparer une première vague de 50 lettres au maximum comme hypothèse de petit test, à réduire si le devis ou la capacité l'exige. Utiliser une seule offre pour diagnostiquer les problèmes ; ne pas disperser un petit volume entre trois promotions.
4. Relever lettres distribuées, visites attribuables au QR, paniers, commandes, livraisons payées, refus, incidents, temps passé et contribution réelle. Les scans ne mesurent pas directement les ouvertures d'enveloppes.
5. Observer le deuxième achat, notamment à conditions normales, sur une fenêtre complète de 30 jours pour chaque client. Le petit échantillon sert à apprendre ; il ne permet pas de promettre un taux de conversion stable.
6. N'imprimer une nouvelle vague qu'après correction des incidents et vérification des coûts. Si le coût d'acquisition n'est pas couvert dans la fenêtre observée, limiter la dépense à une perte d'apprentissage explicitement acceptée ; ne pas financer l'expansion sur une fidélité future supposée.

CAC papier = (coût impression + enveloppes + distribution) / nombre de nouveaux clients attribués avec première commande livrée et payée. Sans nouveau client, ne pas calculer un coût unitaire fini. Les avantages commerciaux restent dans la contribution des commandes pour éviter un double comptage.

Exemple purement illustratif : 100 lettres à 2 DH et deux clients payants donnent un CAC papier de 100 DH/client. Le prix de 2 DH n'est pas un devis. Une contribution de 20 DH par commande demande cinq commandes identiques pour couvrir ce seul CAC, avant les charges fixes.

## 9. Vérifications avant impression

- Panier dominé par le niveau 1, panier découverte, panier au seuil de gratuité, second carton, paiement facturé, achat plus cher et commande refusée : les coûts et le financement éventuel d'une perte sont visibles.
- Les prix sont cohérents entre l'accueil, le catalogue, le panier et la validation ; la commande confirmée conserve le total accepté.
- Une substitution demande un accord ; un achat annulé ou refusé n'est pas compté comme client acquis.
- Les conditions réelles de livraison et d'un éventuel cadeau correspondent au texte de la brochure et de la page QR.
- Le QR final se scanne sur une épreuve imprimée à taille réelle ; les éléments importants restent éloignés des plis.
- Aucune statistique, garantie de qualité, comparaison de prix ou gratuité n'est publiée sans pouvoir être justifiée et honorée.

## Références externes

- University of Maine Cooperative Extension, Basic Pricing Strategies for Small Businesses : coûts, distinction entre majoration et marge, rémunération et frais généraux. https://extension.umaine.edu/publications/3000e/
- Baymard, Save Account Creation for the Confirmation Step : l'identification précoce peut freiner le parcours ; cela soutient une hypothèse à tester chez Souki, pas une prévision de gain local. https://baymard.com/research-articles/delayed-account-creation
