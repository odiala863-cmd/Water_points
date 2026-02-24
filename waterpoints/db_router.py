# waterpoints/db_router.py
class PrimaryReplicaRouter:
    """Database router for read/write splitting"""
    
    def db_for_read(self, model, **hints):
        """Send reads to replica"""
        return 'replica'
        
    def db_for_write(self, model, **hints):
        """Send writes to primary"""
        return 'default'
        
    def allow_relation(self, obj1, obj2, **hints):
        """Allow relations if both objects are in same database"""
        db_list = ('default', 'replica')
        if obj1._state.db in db_list and obj2._state.db in db_list:
            return True
        return None
        
    def allow_migrate(self, db, app_label, model_name=None, **hints):
        """Only run migrations on primary"""
        return db == 'default'