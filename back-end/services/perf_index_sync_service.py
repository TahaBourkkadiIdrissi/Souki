from sqlalchemy import text

from config import engine


class PerfIndexSyncService:
    """
    Index de performance recommandes par la revue d'algorithmes (Part 3) :
    - t_commandes(date_commande, statut) : fenetres JIT/dashboard/courbe CA
    - t_addresses(user_id, is_default)   : resolution adresse par defaut (JIT, dispatch)
    - T_Product(is_active, stock, niveau): catalogue actif, suggestions, ML
    - t_jit_logs(date_execution, statut) : detection "JIT deja execute aujourd'hui"
    """

    @staticmethod
    def sync() -> None:
        if engine.dialect.name != "postgresql":
            return

        with engine.begin() as conn:
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_commandes_date_statut "
                "ON t_commandes(date_commande, statut)"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_addresses_user_default "
                "ON t_addresses(user_id, is_default)"
            ))
            conn.execute(text(
                'CREATE INDEX IF NOT EXISTS idx_product_active_stock_niveau '
                'ON "T_Product"(is_active, stock, niveau)'
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_jit_logs_date_statut "
                "ON t_jit_logs(date_execution, statut)"
            ))
