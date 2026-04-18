# Migration - Ancien Code vers Nouvelle Architecture

## Mapping des Imports

### Avant (Ancien Code)
```python
from entities import User, Address, Product, CommandeVocale, LigneCommandeVocale
from dto import UserRegister, LoginRequest, ProductResponseDTO, VoiceBasketResponseDTO
from services import AuthService, CatalogueService, CommandeVocaleService
from controllers import auth_router, profile_router, router_voice, router_catalogue
```

### Après (Nouvelle Architecture) - Identique !
```python
from entities import User, Address, Product, CommandeVocale, LigneCommandeVocale
from dto import UserRegister, LoginRequest, ProductResponseDTO, VoiceBasketResponseDTO
from services import AuthService, CatalogueService, CommandeVocaleService
from controllers import auth_router, profile_router, router_voice, router_catalogue
```

✅ **Les imports publics restent identiques grâce aux `__init__.py`**

## Ancien `entities.py` → Nouvelle Structure

```python
# Avant : entities.py (345 lignes dans 1 fichier)
class User(Base): ...
class Address(Base): ...
class Product(Base): ...
class CommandeVocale(Base): ...
class LigneCommandeVocale(Base): ...

# Après : Organisé en 5 fichiers dans entities/
# entities/user_entity.py → class User
# entities/address_entity.py → class Address
# entities/product_entity.py → class Product
# entities/commande_vocale_entity.py → class CommandeVocale, LigneCommandeVocale
```

## Ancien `services.py` → Nouvelle Structure

```python
# Avant : services.py (400+ lignes)
class AuthService: ...
class ProfileService: ...
class ICatalogueService(ABC): ...
class CatalogueService: ...
class ICommandeVocaleService(ABC): ...
class CommandeVocaleService: ...

# Après : Organisé en 4 fichiers dans services/
# services/auth_service.py → AuthService
# services/profile_service.py → ProfileService
# services/catalogue_service.py → ICatalogueService, CatalogueService
# services/commande_service.py → ICommandeVocaleService, CommandeVocaleService
```

## Ancien `dao.py` → Nouvelle Structure

```python
# Avant : dao.py (200+ lignes)
class UserDao: ...
class AddressDao: ...
class IProductDao(ABC): ...
class ProductDaoBD: ...
class ICommandeVocaleDao(ABC): ...
class CommandeVocaleDaoBD: ...

# Après : Organisé en 4 fichiers dans dao/ + 6 fichiers dans interfaces/
# dao/user_dao.py → UserDao
# dao/address_dao.py → AddressDao
# dao/product_dao.py → ProductDaoBD
# dao/commande_dao.py → CommandeVocaleDaoBD
# interfaces/product_dao_interface.py → IProductDao
# interfaces/commande_dao_interface.py → ICommandeVocaleDao
```

## Ancien `controllers.py` → Nouvelle Structure

```python
# Avant : controllers.py (140+ lignes)
auth_router = APIRouter(...)
@auth_router.post("/register"): ...
@auth_router.post("/login"): ...

profile_router = APIRouter(...)
@profile_router.post("/address"): ...

router_catalogue = APIRouter(...)
@router_catalogue.get("/catalogue"): ...

router_voice = APIRouter(...)
@router_voice.post("/text-basket"): ...
@router_voice.post("/voice-basket"): ...

# Après : Organisé en 4 fichiers dans controllers/
# controllers/auth_controller.py → auth_router
# controllers/profile_controller.py → profile_router
# controllers/catalogue_controller.py → router_catalogue
# controllers/commande_controller.py → router_voice
```

## Ancien `dto.py` → Nouvelle Structure

```python
# Avant : dto.py (60+ lignes)
class UserRegister: ...
class LoginRequest: ...
class UserResponse: ...
class GoogleLoginRequest: ...
class AddressDTO: ...
class ProductResponseDTO: ...
class TextBasketRequest: ...
class LigneCommandeDTO: ...
class VoiceBasketResponseDTO: ...

# Après : Organisé en 4 fichiers dans dto/
# dto/user_dto.py → UserRegister, LoginRequest, UserResponse, GoogleLoginRequest
# dto/address_dto.py → AddressDTO
# dto/product_dto.py → ProductResponseDTO
# dto/commande_dto.py → TextBasketRequest, LigneCommandeDTO, VoiceBasketResponseDTO
```

## Nouveau : Fichiers `api/`

```python
# Nouveau :
# api/keys.py → Centralize GEMINI_API_KEY, GOOGLE_CLIENT_ID
# api/algorithms.py → _call_gemini(), SYSTEM_PROMPT

# Avant : Éparpillés dans services.py
MODELS = [...]
SYSTEM_PROMPT = """..."""

def _call_gemini(...): ...
```

## Dépendances et Injection

### Avant (Dans controllers.py)
```python
from dependencies import get_catalogue_service, get_voice_service

@router_catalogue.get("/catalogue")
def get_catalogue(service: ICatalogueService = Depends(get_catalogue_service)):
    with service:
        return service.get_catalogue_complet()
```

### Après (Identique - Les Controllers restent similaires)
```python
from dependencies import get_catalogue_service

@router_catalogue.get("/catalogue")
def get_catalogue(service: ICatalogueService = Depends(get_catalogue_service)):
    with service:
        return service.get_catalogue_complet()
```

## Résumé des Changements Structurels

| Aspect | Avant | Après |
|--------|-------|-------|
| Fichiers monolithiques | 7 fichiers (500+ lignes chacun) | 30+ fichiers (30-50 lignes chacun) |
| Responsabilités | Mélangées | Séparées |
| Interfaces | Interne aux services | Dédiées dans `interfaces/` |
| Clés API | Dans `services.py` | Centralisées dans `api/keys.py` |
| Logique IA | Mélangée à la biz logic | Isolée dans `api/algorithms.py` |
| Testabilité | Difficile (dépendances couplées) | Facile (injection de dépendances) |

## ✅ Avantages de la Migration

- **Maintenabilité** : Chaque fichier = une responsabilité
- **Testabilité** : Interfaces permettent les mocks
- **Scalabilité** : Facile d'ajouter des features
- **Clarté** : Structure évidente
- **Réutilisabilité** : Services/DAOs utilisables partout
- **Découplage** : Moins de dépendances circulaires

---

**Migration Status** : ✅ 100% complétée avec rétro-compatibilité
