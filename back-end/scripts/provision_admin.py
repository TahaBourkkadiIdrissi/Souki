"""Create the first full administrator through an explicit operations command.

The password is requested interactively so it never appears in shell history.
This script refuses to promote or overwrite an existing account.
"""
import argparse
import getpass
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main() -> int:
    parser = argparse.ArgumentParser(description="Provisionner un compte administrateur Souki")
    parser.add_argument("--apply", action="store_true", help="Confirmer l'écriture dans la base configurée")
    parser.add_argument("--email", required=True, help="Adresse email unique de l'administrateur")
    parser.add_argument("--phone", help="Numéro marocain facultatif")
    args = parser.parse_args()
    if not args.apply:
        parser.error("Vérifiez la base cible puis ajoutez --apply.")

    password = getpass.getpass("Mot de passe admin : ")
    confirmation = getpass.getpass("Confirmez le mot de passe : ")
    if password != confirmation:
        parser.error("Les mots de passe ne correspondent pas.")

    from dto.user_dto import UserRegister
    from config import LocalSession
    from entities.role_entity import Role
    from entities.user_entity import User
    from entities.user_role_entity import UserRole
    from production_checks import validate_production_config
    from security import hash_password

    validate_production_config()
    validated = UserRegister(email=args.email, phone=args.phone, password=password, role="ADMIN")
    db = LocalSession()
    try:
        existing = db.query(User).filter(User.email == str(validated.email)).first()
        if existing is None and validated.phone:
            existing = db.query(User).filter(User.phone == validated.phone).first()
        if existing is not None:
            raise RuntimeError("Un compte utilise déjà cet email ou ce téléphone; aucune modification effectuée.")
        admin_role = db.query(Role).filter(Role.code == "ADMIN", Role.is_active.is_(True)).first()
        if admin_role is None:
            raise RuntimeError("Le RBAC n'est pas initialisé. Exécutez d'abord scripts/bootstrap.py --apply.")

        user = User(
            email=str(validated.email),
            phone=validated.phone,
            password=hash_password(validated.password),
            role="ADMIN",
            is_verified=True,
            is_email_verified=True,
            is_phone_verified=bool(validated.phone),
            is_active=True,
            auth_provider="local",
        )
        db.add(user)
        db.flush()
        db.add(UserRole(user_id=int(user.id), role_id=int(admin_role.id), is_active=True))
        db.commit()
        print(f"Administrateur créé (id={user.id}, email={user.email}).")
        return 0
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
