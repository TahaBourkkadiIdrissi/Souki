from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from entities.mobile_push_device_entity import MobilePushDevice


class MobilePushDeviceDaoBD:

    def upsert_device(self, session: Session, *, user_id: int, token: str, platform: str) -> MobilePushDevice:
        device = session.execute(
            select(MobilePushDevice).where(MobilePushDevice.token == token)
        ).scalar_one_or_none()

        now = datetime.now(timezone.utc)
        if device is None:
            device = MobilePushDevice(
                user_id=user_id,
                token=token,
                platform=platform,
                created_at=now,
                last_seen_at=now,
            )
            session.add(device)
        else:
            # Meme installation, autre compte (deconnexion puis connexion) : le
            # jeton suit le dernier compte connecte, sans doublon.
            device.user_id = user_id
            device.platform = platform
            device.last_seen_at = now
            device.revoked_at = None

        session.flush()
        return device

    def get_active_devices(self, session: Session, user_id: int) -> list[MobilePushDevice]:
        return list(
            session.execute(
                select(MobilePushDevice)
                .where(
                    MobilePushDevice.user_id == user_id,
                    MobilePushDevice.revoked_at.is_(None),
                )
                .order_by(MobilePushDevice.last_seen_at.desc())
            ).scalars()
        )

    def count_active_devices(self, session: Session, user_id: int) -> int:
        return int(
            session.execute(
                select(func.count(MobilePushDevice.id)).where(
                    MobilePushDevice.user_id == user_id,
                    MobilePushDevice.revoked_at.is_(None),
                )
            ).scalar_one()
        )

    def revoke_by_token(self, session: Session, *, token: str, user_id: int | None = None) -> bool:
        query = select(MobilePushDevice).where(MobilePushDevice.token == token)
        if user_id is not None:
            query = query.where(MobilePushDevice.user_id == user_id)

        device = session.execute(query).scalar_one_or_none()
        if device is None or device.revoked_at is not None:
            return False

        device.revoked_at = datetime.now(timezone.utc)
        session.flush()
        return True

    def delete_for_user(self, session: Session, user_id: int) -> None:
        session.query(MobilePushDevice).filter(MobilePushDevice.user_id == user_id).delete(synchronize_session=False)
        session.flush()
