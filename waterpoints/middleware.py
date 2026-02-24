# waterpoints/middleware.py
import time
import logging
from django.db import connection
from django.conf import settings

logger = logging.getLogger(__name__)

class QueryCountMiddleware:
    """Middleware to log database query counts and execution time"""
    
    def __init__(self, get_response):
        self.get_response = get_response
        
    def __call__(self, request):
        # Start timing
        start_time = time.time()
        
        # Reset query count
        response = self.get_response(request)
        
        # Calculate duration
        duration = time.time() - start_time
        query_count = len(connection.queries)
        
        # Log if too many queries
        if query_count > 50:
            logger.warning(
                f"High query count: {query_count} queries "
                f"in {duration:.2f}s for {request.path}"
            )
            
        # Log slow requests
        if duration > 2.0:
            logger.warning(
                f"Slow request: {duration:.2f}s "
                f"with {query_count} queries for {request.path}"
            )
            
        # Add headers in debug mode
        if settings.DEBUG:
            response['X-Query-Count'] = query_count
            response['X-Total-Time'] = f"{duration:.2f}s"
            
        return response


class DatabaseReadOnlyMiddleware:
    """Middleware to set database to read-only mode for maintenance"""
    
    def __init__(self, get_response):
        self.get_response = get_response
        
    def __call__(self, request):
        if request.method not in ['GET', 'HEAD', 'OPTIONS']:
            # Check if system is in maintenance mode
            if getattr(settings, 'MAINTENANCE_MODE', False):
                from django.http import JsonResponse
                return JsonResponse(
                    {'error': 'System is in maintenance mode'},
                    status=503
                )
        return self.get_response(request)