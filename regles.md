```
================================================================================
                    RÈGLES & CONTRAINTES ABSOLUES — PROJET SOUKI
                    À LIRE ET RESPECTER AVANT TOUTE TÂCHE
================================================================================

Ces règles s'appliquent à CHAQUE tâche, nouvelle ou ancienne,
frontend ou backend, petite ou grande.
AUCUNE EXCEPTION. AUCUNE DÉROGATION.

================================================================================
                         🏗️ ARCHITECTURE
================================================================================

1. RESPECTER L'ARCHITECTURE MVC2 EXISTANTE STRICTEMENT
   ├─ Controller  → reçoit HTTP, délègue au service, ne contient PAS de logique
   ├─ Service     → toute la logique métier, orchestre les DAOs
   ├─ DAO         → uniquement accès base de données (flush, jamais commit)
   ├─ Interface   → contrat ABC obligatoire pour chaque DAO et Service
   ├─ Entity      → mappe uniquement la table SQL, aucune logique
   └─ DTO         → données échangées entre couches (Pydantic BaseModel)

2. TOUJOURS UTILISER LES INTERFACES ABC
   ├─ Chaque nouveau DAO doit implémenter une interface ABC
   ├─ Chaque nouveau Service doit implémenter une interface ABC
   └─ Suivre EXACTEMENT le pattern des interfaces existantes

3. RÈGLE FLUSH / COMMIT — CRITIQUE
   ├─ session.flush()   → UNIQUEMENT dans les DAOs, après chaque opération
   ├─ session.commit()  → UNIQUEMENT dans les Services, à la toute fin
   ├─ session.rollback()→ UNIQUEMENT dans les Services, en cas d'erreur
   ├─ JAMAIS de commit dans un DAO
   ├─ JAMAIS de rollback dans un DAO
   ├─ JAMAIS de LocalSession() créé dans un Service
   └─ La session est toujours créée dans le Controller et passée au Service

   VÉRIFICATION OBLIGATOIRE SUR CHAQUE NOUVELLE TÂCHE :
   Avant d'écrire le moindre code, vérifier dans CHAQUE fichier concerné :
   ✓ Les DAOs n'ont que flush() — jamais commit() ni rollback()
   ✓ Les Services ont commit() à la fin et rollback() dans le except
   ✓ Aucun Service ne crée de LocalSession() lui-même
   ✓ La session vient toujours du Controller

   SI UNE VIOLATION EST TROUVÉE DANS UN FICHIER EXISTANT (ancien code) :
   → NE PAS corriger silencieusement
   → POSER LA QUESTION à l'utilisateur d'abord :
     "J'ai trouvé une violation flush/commit dans {fichier} ligne {X}.
      Voulez-vous que je la corrige avant de continuer ?"
   → Attendre la réponse avant toute action

4. TRANSACTIONS — ATOMICITÉ
   ├─ Toutes les étapes d'une opération dans UN SEUL commit à la fin
   ├─ Si une étape échoue → rollback() annule TOUT
   └─ Pas de commit partiel au milieu d'une opération

5. FRONTEND — ARCHITECTURE
   ├─ App Router Next.js → respecter la structure app/ existante
   ├─ Tous les appels API passent par front-end/lib/api.ts
   ├─ Pattern apiCall<T> à respecter strictement
   └─ Hooks, composants, pages → respecter la structure existante

================================================================================
                         📁 FICHIERS ET DOSSIERS
================================================================================

6. NE JAMAIS SUPPRIMER DE FICHIERS EXISTANTS

7. NE JAMAIS SUPPRIMER DE DOSSIERS EXISTANTS

8. NE JAMAIS MODIFIER LES TABLES SQL EXISTANTES

9. NE JAMAIS MODIFIER LES ENTITIES EXISTANTES

10. CRÉER DE NOUVEAUX FICHIERS UNIQUEMENT SI ABSOLUMENT NÉCESSAIRE
    └─ Justifier dans le rapport pourquoi la création est indispensable

11. MODIFIER LES FICHIERS EXISTANTS EN AJOUTANT
    └─ Pas en remplaçant ou supprimant ce qui fonctionne déjà

================================================================================
                         🔒 FONCTIONNALITÉS EXISTANTES
================================================================================

12. NE JAMAIS CASSER UNE FONCTIONNALITÉ QUI FONCTIONNE DÉJÀ

13. NE JAMAIS RENOMMER DES FONCTIONS, VARIABLES OU ÉTATS EXISTANTS

14. NE JAMAIS MODIFIER LES useState ET useEffect EXISTANTS

15. NE JAMAIS MODIFIER LES APPELS API EXISTANTS

16. NE JAMAIS MODIFIER LES ALERTDIALOG ET LEUR LOGIQUE EXISTANTE

17. NE JAMAIS MODIFIER LES HANDLERS onClick, onChange EXISTANTS

================================================================================
                         🎨 STYLE ET DESIGN
================================================================================

18. RESPECTER LES COULEURS DU SITE
    ├─ Vert principal  : #1E8A3C
    ├─ Vert hover      : #166d30
    ├─ Vert light      : #F0FDF4
    ├─ Background page : #F8F9FA
    ├─ Surface card    : #FFFFFF
    ├─ Border          : #E5E7EB
    └─ Ne pas inventer de nouvelles couleurs

19. RESPECTER LE STYLE DES PAGES ADMIN EXISTANTES
    ├─ Même cards (rounded-xl, border, shadow-sm)
    ├─ Même tableaux (header gray-50, divide-y, hover)
    ├─ Même badges (rounded-full, border colorée)
    ├─ Même boutons (primaire vert, secondaire blanc, danger rouge)
    └─ Même spacing et typographie

20. COHÉRENCE ENTRE LES PAGES ADMIN
    ├─ Toutes les pages admin ont le même layout
    ├─ Même top bar sticky
    ├─ Même sidebar si applicable
    └─ Même style de sections et tableaux

================================================================================
                         🔐 SÉCURITÉ ET AUTH
================================================================================

21. TOUS LES ENDPOINTS ADMIN SONT PROTÉGÉS
    ├─ Utiliser require_permission() existant
    ├─ Minimum : admin.panel.access
    └─ Suivre le pattern des autres controllers

22. NE JAMAIS AFFAIBLIR LES PERMISSIONS EXISTANTES

23. TOKEN JWT TOUJOURS PASSÉ DANS LES APPELS API FRONTEND
    └─ Authorization: Bearer {token} via le hook useAuth existant

================================================================================
                         📋 PROCESSUS DE TRAVAIL
================================================================================

24. EXPLORER AVANT DE CODER — TOUJOURS
    ├─ Lire TOUS les fichiers concernés avant d'écrire une ligne
    ├─ Identifier le pattern exact à suivre dans les fichiers existants
    └─ Produire un rapport d'exploration si demandé

25. CHECK FLUSH/COMMIT OBLIGATOIRE AU DÉBUT DE CHAQUE TÂCHE
    Pour chaque fichier DAO et Service concerné par la tâche :

    VÉRIFIER :
    ┌─────────────────────────────────────────────────────────┐
    │  FICHIER          │ flush() DAO ? │ commit() Service ?  │
    │  ──────────────── │ ──────────── │ ──────────────────  │
    │  xxx_dao.py       │ ✅/❌        │ N/A                 │
    │  xxx_service.py   │ N/A          │ ✅/❌               │
    └─────────────────────────────────────────────────────────┘

    SI VIOLATION TROUVÉE DANS UN FICHIER EXISTANT :
    → NE PAS corriger automatiquement
    → DEMANDER à l'utilisateur :
      "⚠️ Violation flush/commit trouvée :
       Fichier  : {nom_fichier}
       Ligne    : {numéro}
       Problème : {description}
       Voulez-vous que je corrige cela avant de continuer ?"
    → Attendre confirmation avant toute correction

    SI VIOLATION DANS UN NOUVEAU FICHIER QUE L'ON CRÉE :
    → Corriger directement sans demander
    → Mentionner dans le rapport

26. RAPPORT OBLIGATOIRE APRÈS CHAQUE TÂCHE
    ├─ Fichiers créés : nom, rôle, lignes
    ├─ Fichiers modifiés : ce qui a changé, pourquoi, lignes exactes
    ├─ Fichiers non touchés : confirmation
    ├─ Check flush/commit : résultat pour chaque DAO/Service concerné
    ├─ Violations trouvées : décrites + action prise (corrigé / en attente)
    ├─ Problèmes rencontrés : description + solution
    ├─ Checklist complétée : item par item avec statut
    └─ Résumé final : ajouté / modifié / supprimé / ignoré

27. VÉRIFICATIONS OBLIGATOIRES AVANT DE LIVRER
    ├─ Backend  : python -m compileall back-end
    ├─ Frontend : tsc --noEmit (TypeScript sans erreurs)
    └─ Git      : git diff --check (pas de conflits)

28. NE PAS RÉPÉTER L'EXPLORATION SI DÉJÀ FAITE
    └─ Si un rapport d'exploration existe → aller directement au code

================================================================================
                         🚫 INTERDICTIONS ABSOLUES
================================================================================

29. NE JAMAIS CRÉER DE LOGIQUE MÉTIER DANS UN CONTROLLER

30. NE JAMAIS CRÉER DE REQUÊTE SQL DANS UN SERVICE

31. NE JAMAIS FAIRE DE session.commit() DANS UN DAO

32. NE JAMAIS FAIRE DE session.rollback() DANS UN DAO

33. NE JAMAIS CRÉER DE LocalSession() DANS UN SERVICE
    └─ La session vient toujours du Controller

34. NE JAMAIS MODIFIER livreur_dao.py ET livreur_service.py
    └─ Ces fichiers sont réservés à un autre collègue

35. NE JAMAIS AJOUTER DE NOUVELLES DÉPENDANCES npm OU pip
    └─ Utiliser uniquement ce qui est déjà installé

36. NE JAMAIS TOUCHER NotificationOutboxService POUR L'INSTANT
    └─ Les notifications sont prévues pour une phase ultérieure

37. NE JAMAIS INVENTER DES PERMISSIONS QUI N'EXISTENT PAS
    └─ Vérifier dans rbac_config.py avant d'utiliser une permission

38. NE JAMAIS AFFICHER LES PRIX/MONTANTS CALCULÉS PAR LE JIT
    └─ Le sous-total JIT est calculé sur quantité brute réelle uniquement

39. NE JAMAIS CRÉER DES ROUTES EN DOUBLE
    └─ Vérifier que l'endpoint n'existe pas déjà avant de le créer

40. NE JAMAIS CORRIGER UNE VIOLATION DANS UN FICHIER EXISTANT
    SANS AVOIR DEMANDÉ LA PERMISSION À L'UTILISATEUR

================================================================================
                         ✅ CE QUI DOIT TOUJOURS ÊTRE FAIT
================================================================================

41. TOUJOURS SUIVRE LE PATTERN EXACT DES FICHIERS EXISTANTS
    └─ Copier le style, pas l'inventer

42. TOUJOURS AJOUTER LES IMPORTS NÉCESSAIRES
    └─ Vérifier que chaque import existe avant de l'utiliser

43. TOUJOURS GÉRER LES ERREURS
    ├─ try/except dans les DAOs et Services
    ├─ try/catch dans le frontend
    └─ Messages d'erreur clairs et utiles

44. TOUJOURS TYPER CORRECTEMENT EN TYPESCRIPT
    └─ Pas de any inutile — interfaces propres dans api.ts

45. TOUJOURS VÉRIFIER LA COHÉRENCE FRONT ↔ BACK
    ├─ Chaque endpoint backend a une fonction dans api.ts
    ├─ Chaque interface TypeScript correspond au DTO Python
    └─ Les champs ont les mêmes noms et types des deux côtés

46. TOUJOURS INCLURE LE CHECK FLUSH/COMMIT DANS LE RAPPORT FINAL
    Format obligatoire dans chaque rapport :

    ## 🔍 CHECK FLUSH/COMMIT
    | Fichier | Rôle | flush() OK ? | commit() OK ? | LocalSession() absent ? | Statut |
    |---------|------|-------------|--------------|------------------------|--------|
    | dao.py  | DAO  | ✅          | N/A          | N/A                    | ✅ OK  |
    | svc.py  | Svc  | N/A         | ✅           | ✅                     | ✅ OK  |

    Violations trouvées :
    | Fichier | Ligne | Description | Action |
    |---------|-------|-------------|--------|
    | xxx.py  | 42    | commit() dans DAO | ⏳ En attente confirmation utilisateur |

================================================================================
                         📌 RAPPELS SPÉCIFIQUES AU PROJET
================================================================================

47. SCHEDULER JIT → automatique à 20h00 chaque soir
    └─ Ne pas modifier le scheduler sauf si explicitement demandé

48. STATUTS COMMANDES AUTORISÉS (ne pas en inventer d'autres) :
    BROUILLON / EN_ATTENTE / CONFIRMEE / VERROUILLEE /
    A_LIVRER / EN_ROUTE / LIVRE / ABSENT / ANNULEE / REFUS

49. BLACKLIST → bloque uniquement COD, pas Wallet ni CMI

50. FICHE CLIENT → tabs internes (6 blocs) déjà implémentés
    └─ Ne pas les re-créer, les améliorer uniquement si demandé

51. PAGE /admin/orders → référence de style pour toutes les pages admin
    └─ Toute nouvelle page admin doit avoir le même style

52. RAPPORT MENSUEL BLACKLIST → groupé par client + livreur + quartier

53. DOUBLE JIT → protégé par JITAlreadyExecutedError
    └─ Ne pas modifier cette protection

54. COD → endpoint /api/commandes/cod/verouillees (pas /demain)
    └─ /demain est gardé comme alias deprecated uniquement

55. VIOLATION FLUSH/COMMIT CONNUE ET EN ATTENTE :
    └─ jit_service.py → LocalSession() créé dans le bloc except
       de executer_job_jit() — à corriger si l'utilisateur le demande

================================================================================
                    FIN DES CONTRAINTES — TOUJOURS RESPECTÉES
================================================================================
```