"""
Django settings for Water project.
Production-ready optimized version with comprehensive features.
"""

from pathlib import Path
import os
import sys
import logging
from datetime import timedelta
from dotenv import load_dotenv
import dj_database_url

# ============================================
# BASE DIRECTORIES
# ============================================
BASE_DIR = Path(__file__).resolve().parent.parent
APPS_DIR = BASE_DIR / "waterpoints"
TEMP_DIR = BASE_DIR / "tmp"
LOGS_DIR = BASE_DIR / "logs"

# Create necessary directories
for directory in [TEMP_DIR, LOGS_DIR]:
    directory.mkdir(exist_ok=True)

# ============================================
# ENVIRONMENT CONFIGURATION
# ============================================
ENV_FILE = os.getenv("ENV_FILE", str(BASE_DIR / ".env"))
if os.path.exists(ENV_FILE):
    load_dotenv(ENV_FILE)

ENVIRONMENT = os.getenv("DJANGO_ENVIRONMENT", "production")
DEBUG = ENVIRONMENT == "development"

# ============================================
# SECURITY SETTINGS
# ============================================
SECRET_KEY = os.getenv(
    "DJANGO_SECRET_KEY",
    "django-insecure-unsafe-key-change-in-production" if DEBUG else None
)
if not SECRET_KEY and not DEBUG:
    raise ValueError("DJANGO_SECRET_KEY must be set in production")

ALLOWED_HOSTS = os.getenv(
    "DJANGO_ALLOWED_HOSTS",
    "localhost,127.0.0.1,.onrender.com" if not DEBUG else "localhost,127.0.0.1"
).split(",")

# Security middleware settings
SECURE_SSL_REDIRECT = False
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_HSTS_SECONDS = 31536000 if not DEBUG else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD = not DEBUG

# Rate limiting
DATA_UPLOAD_MAX_NUMBER_FIELDS = 10000
DATA_UPLOAD_MAX_MEMORY_SIZE = 26214400  # 25MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 26214400  # 25MB

# ============================================
# INTERNATIONALIZATION (MUST BE EARLY)
# ============================================
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Africa/Nairobi'
USE_I18N = True
USE_TZ = True
USE_L10N = True

# ============================================
# APPLICATION DEFINITION
# ============================================
DJANGO_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.gis',
    'django.contrib.humanize',
]

THIRD_PARTY_APPS = [
    # REST Framework
    'rest_framework',
    'rest_framework_gis',
    'rest_framework.authtoken',
    
    # Authentication
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'knox',
    
    # Utilities
    'django_filters',
    'corsheaders',
    'drf_yasg',
    
    # Performance
    'cacheops',
    'django_prometheus',
    
    # Admin enhancements
    'admin_interface',
    'colorfield',
    'import_export',
]

LOCAL_APPS = [
    'waterpoints.apps.WaterpointsConfig',
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# Admin interface theme
X_FRAME_OPTIONS = 'SAMEORIGIN'
SILENCED_SYSTEM_CHECKS = ['security.W019']

# ============================================
# MIDDLEWARE
# ============================================
MIDDLEWARE = [
    # Performance first
    'django_prometheus.middleware.PrometheusBeforeMiddleware',
    
    # Security
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    
    # Core Django
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.locale.LocaleMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'allauth.account.middleware.AccountMiddleware',
    
    # Query counting in debug mode
    *(['waterpoints.middleware.QueryCountMiddleware'] if DEBUG else []),
    
    # Performance monitoring
    'django_prometheus.middleware.PrometheusAfterMiddleware',
]

ROOT_URLCONF = 'Water.urls'

# ============================================
# TEMPLATES
# ============================================
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / "templates"],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'django.template.context_processors.media',
                'django.template.context_processors.static',
            ],
            'debug': DEBUG,
        },
    },
]

WSGI_APPLICATION = 'Water.wsgi.application'

# ============================================
# DATABASE CONFIGURATION - FIXED VERSION
# ============================================
USE_PROD_DB = os.getenv("USE_PROD_DB", "False") == "True"

if USE_PROD_DB:
    # Production PostgreSQL with persistent connections
    default_db = dj_database_url.parse(
        os.getenv("DATABASE_URL"),
        conn_max_age=600,  # Keep connections alive for 10 minutes
        ssl_require=True
    )
    
    # Update with PostGIS engine and valid connection options
    default_db.update({
        'ENGINE': 'django.contrib.gis.db.backends.postgis',
        'OPTIONS': {
            'connect_timeout': 10,  # Connection timeout in seconds
            'keepalives': 1,  # Enable TCP keepalives
            'keepalives_idle': 30,  # Seconds before sending keepalive
            'keepalives_interval': 10,  # Seconds between keepalives
            'keepalives_count': 5,  # Max keepalive probes
        }
    })
    
    # Read replica for heavy analytics (optional)
    if os.getenv("DATABASE_REPLICA_URL"):
        replica_db = dj_database_url.parse(
            os.getenv("DATABASE_REPLICA_URL"),
            conn_max_age=600,
            ssl_require=True
        )
        replica_db.update({
            'ENGINE': 'django.contrib.gis.db.backends.postgis',
            'OPTIONS': {
                'connect_timeout': 10,
                'keepalives': 1,
                'keepalives_idle': 30,
                'keepalives_interval': 10,
                'keepalives_count': 5,
            }
        })
        
        DATABASES = {
            'default': default_db,
            'replica': replica_db,
        }
        
        # Database router for read/write splitting
        DATABASE_ROUTERS = ['waterpoints.db_router.PrimaryReplicaRouter']
    else:
        DATABASES = {'default': default_db}
        
    # Optional: Add connection pooler settings if using PgBouncer
    if os.getenv("USE_PGBOUNCER", "False") == "True":
        DATABASES['default']['DISABLE_SERVER_SIDE_CURSORS'] = True
else:
    # Development SQLite with Spatialite
    DATABASES = {
        'default': {
            'ENGINE': os.getenv("LOCAL_DB_ENGINE", "django.contrib.gis.db.backends.spatialite"),
            'NAME': BASE_DIR / os.getenv("LOCAL_DB_NAME", "db.sqlite3"),
            'OPTIONS': {
                'timeout': 20,
                'check_same_thread': False,
            }
        }
    }

# Spatialite configuration
SPATIALITE_LIBRARY_PATH = None
if not USE_PROD_DB:
    SPATIALITE_LIBRARY_PATH = os.getenv("SPATIALITE_LIBRARY_PATH", "mod_spatialite")

# ============================================
# CACHE CONFIGURATION
# ============================================
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': os.getenv('REDIS_URL', 'redis://localhost:6379/0'),
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'CONNECTION_POOL_CLASS': 'redis.BlockingConnectionPool',
            'CONNECTION_POOL_CLASS_KWARGS': {
                'max_connections': 50,
                'timeout': 20,
            },
            'MAX_CONNECTIONS': 1000,
            'PICKLE_VERSION': -1,
        },
        'KEY_PREFIX': 'water',
        'TIMEOUT': 60 * 15,  # 15 minutes
    },
    'session': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': os.getenv('REDIS_URL', 'redis://localhost:6379/1'),
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        },
        'KEY_PREFIX': 'session',
        'TIMEOUT': 60 * 60 * 24,  # 24 hours
    }
}

# Cache middleware
CACHE_MIDDLEWARE_ALIAS = 'default'
CACHE_MIDDLEWARE_SECONDS = 300
CACHE_MIDDLEWARE_KEY_PREFIX = 'water'

# Cacheops automatic query caching
CACHEOPS_REDIS = os.getenv('REDIS_URL', 'redis://localhost:6379/2')
CACHEOPS_DEFAULTS = {'timeout': 60 * 15}
CACHEOPS = {
    'waterpoints.*': {'ops': 'all', 'timeout': 60 * 15},
    'auth.user': {'ops': 'get', 'timeout': 60 * 60},
}

# Session configuration
SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
SESSION_CACHE_ALIAS = 'session'
SESSION_COOKIE_AGE = 60 * 60 * 24 * 7  # 7 days
SESSION_SAVE_EVERY_REQUEST = True

# ============================================
# REST FRAMEWORK CONFIGURATION
# ============================================
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
        'knox.auth.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.LimitOffsetPagination',
    'PAGE_SIZE': 100,
    'MAX_PAGE_SIZE': 1000,
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
        'rest_framework.throttling.ScopedRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',
        'user': '1000/hour',
        'analytics': '50/hour',
        'export': '10/hour',
    },
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer' if DEBUG else 'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.FormParser',
        'rest_framework.parsers.MultiPartParser',
    ],
    'DEFAULT_VERSIONING_CLASS': 'rest_framework.versioning.NamespaceVersioning',
    'COERCE_DECIMAL_TO_STRING': False,
    'EXCEPTION_HANDLER': 'waterpoints.api.exceptions.custom_exception_handler',
}

# Knox token authentication
REST_KNOX = {
    'SECURE_HASH_ALGORITHM': 'cryptography.hazmat.primitives.hashes.SHA512',
    'AUTH_TOKEN_CHARACTER_LENGTH': 64,
    'TOKEN_TTL': timedelta(hours=10),
    'USER_SERIALIZER': 'knox.serializers.UserSerializer',
    'TOKEN_LIMIT_PER_USER': None,
    'AUTO_REFRESH': False,
    'MIN_REFRESH_INTERVAL': 60,
}

# ============================================
# CORS CONFIGURATION
# ============================================
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    CORS_ALLOWED_ORIGINS = os.getenv(
        "CORS_ALLOWED_ORIGINS",
        "https://*.onrender.com,https://yourdomain.com"
    ).split(",")
    CORS_ALLOW_CREDENTIALS = True
    CORS_EXPOSE_HEADERS = ['Content-Type', 'X-CSRFToken']

# ============================================
# LOGGING CONFIGURATION
# ============================================
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {asctime} {message}',
            'style': '{',
        },
        'json': {
            'format': '{"timestamp": "%(asctime)s", "level": "%(levelname)s", "module": "%(module)s", "message": "%(message)s"}',
            'datefmt': '%Y-%m-%d %H:%M:%S',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose' if DEBUG else 'json',
            'stream': sys.stdout,
        },
        'file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': LOGS_DIR / 'django.log',
            'maxBytes': 10485760,  # 10MB
            'backupCount': 10,
            'formatter': 'verbose',
        },
        'error_file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': LOGS_DIR / 'error.log',
            'maxBytes': 10485760,
            'backupCount': 10,
            'formatter': 'verbose',
            'level': 'ERROR',
        },
        'analytics_file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': LOGS_DIR / 'analytics.log',
            'maxBytes': 10485760,
            'backupCount': 5,
            'formatter': 'json',
        },
    },
    'root': {
        'handlers': ['console', 'file'],
        'level': 'INFO' if not DEBUG else 'DEBUG',
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file', 'error_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'django.db.backends': {
            'handlers': ['console'] if DEBUG else [],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
        'waterpoints': {
            'handlers': ['console', 'file', 'analytics_file'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
        'celery': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# ============================================
# CELERY CONFIGURATION
# ============================================
CELERY_BROKER_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/3')
CELERY_RESULT_BACKEND = os.getenv('REDIS_URL', 'redis://localhost:6379/4')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60
CELERY_TASK_SOFT_TIME_LIMIT = 25 * 60
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'

# ============================================
# STORAGE CONFIGURATION
# ============================================
# Static files
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'static'] if (BASE_DIR / 'static').exists() else []
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

if not DEBUG and os.getenv('AWS_ACCESS_KEY_ID'):
    # Production S3 storage
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
    AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
    AWS_STORAGE_BUCKET_NAME = os.getenv('AWS_STORAGE_BUCKET_NAME')
    AWS_S3_REGION_NAME = os.getenv('AWS_S3_REGION_NAME', 'eu-west-1')
    AWS_S3_FILE_OVERWRITE = False
    AWS_DEFAULT_ACL = None
    AWS_QUERYSTRING_AUTH = False

# ============================================
# AUTHENTICATION
# ============================================
AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
    'allauth.account.auth_backends.AuthenticationBackend',
]

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LOGIN_URL = '/accounts/login/'
LOGIN_REDIRECT_URL = '/'
LOGOUT_REDIRECT_URL = '/'

# ============================================
# PAGINATION DEFAULTS
# ============================================
PAGINATION_SETTINGS = {
    'DEFAULT_PAGE_SIZE': 100,
    'MAX_PAGE_SIZE': 5000,
    'PAGE_SIZE_QUERY_PARAM': 'page_size',
    'MAX_PAGE_SIZE_EXPORT': 10000,
}

# ============================================
# API SETTINGS
# ============================================
API_SETTINGS = {
    'CACHE_TIMEOUT': 60 * 15,  # 15 minutes
    'ANALYTICS_CACHE_TIMEOUT': 60 * 30,  # 30 minutes
    'HEAVY_QUERY_TIMEOUT': 30,  # seconds
    'MAX_EXPORT_ROWS': 50000,
    'MAX_HEATMAP_POINTS': 5000,
    'DISTANCE_UNIT': 'km',
}

# ============================================
# GEO SPATIAL SETTINGS
# ============================================
GEO_SETTINGS = {
    'DEFAULT_SRID': 4326,
    'DEFAULT_CENTER': [0.0236, 37.9062],  # Kenya
    'DEFAULT_ZOOM': 6,
    'MAX_ZOOM': 18,
    'MIN_ZOOM': 5,
}

# ============================================
# SWAGGER API DOCUMENTATION
# ============================================
SWAGGER_SETTINGS = {
    'SECURITY_DEFINITIONS': {
        'Bearer': {
            'type': 'apiKey',
            'name': 'Authorization',
            'in': 'header'
        }
    },
    'USE_SESSION_AUTH': False,
    'JSON_EDITOR': True,
    'SUPPORTED_SUBMIT_METHODS': [
        'get',
        'post',
        'put',
        'delete',
        'patch'
    ],
}

# ============================================
# PROMETHEUS MONITORING
# ============================================
PROMETHEUS_EXPORT_MIGRATIONS = False

# ============================================
# DEFAULT PRIMARY KEY
# ============================================
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ============================================
# SENTRY ERROR TRACKING
# ============================================
if os.getenv('SENTRY_DSN') and not DEBUG:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.redis import RedisIntegration
    
    sentry_sdk.init(
        dsn=os.getenv('SENTRY_DSN'),
        integrations=[
            DjangoIntegration(),
            CeleryIntegration(),
            RedisIntegration(),
        ],
        traces_sample_rate=0.1,
        send_default_pii=False,
        environment=ENVIRONMENT,
    )

# ============================================
# HEALTH CHECK ENDPOINTS
# ============================================
HEALTH_CHECKS = {
    'database': True,
    'cache': True,
    'storage': True,
    'celery': True,
}

# ============================================
# DEBUG TOOLBAR (Development only)
# ============================================
if DEBUG:
    INSTALLED_APPS += ['debug_toolbar', 'silk']
    MIDDLEWARE.insert(0, 'silk.middleware.SilkyMiddleware')
    MIDDLEWARE.append('debug_toolbar.middleware.DebugToolbarMiddleware')
    
    INTERNAL_IPS = ['127.0.0.1', 'localhost']
    
    DEBUG_TOOLBAR_CONFIG = {
        'SHOW_TOOLBAR_CALLBACK': lambda request: DEBUG,
        'DISABLE_PANELS': {
            'debug_toolbar.panels.redirects.RedirectsPanel',
            'debug_toolbar.panals.profiling.ProfilingPanel',
        },
        'SQL_WARNING_THRESHOLD': 100,  # milliseconds
    }
    
    SILKY_PYTHON_PROFILER = True
    SILKY_META = True
    SILKY_AUTHENTICATION = True
    SILKY_AUTHORISATION = True