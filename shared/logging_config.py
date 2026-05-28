import os


def make_logging_config(module_name: str, log_level: str = "INFO") -> dict:
    """
    Shared logging config factory for all Django modules.
    Logs to console (always) and to logs/<module>.log (if LOG_DIR env is set).
    """
    log_dir = os.getenv("LOG_DIR", "")
    handlers = ["console"]

    if log_dir:
        os.makedirs(log_dir, exist_ok=True)
        handlers.append("file")

    config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "verbose": {
                "format": "[{asctime}] {levelname} {name} {message}",
                "style": "{",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
            "simple": {
                "format": "{levelname} {message}",
                "style": "{",
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "formatter": "verbose",
                "level": log_level,
            },
        },
        "root": {
            "handlers": handlers,
            "level": log_level,
        },
        "loggers": {
            module_name: {
                "handlers": handlers,
                "level": log_level,
                "propagate": False,
            },
            "django": {
                "handlers": handlers,
                "level": "WARNING",
                "propagate": False,
            },
            "django.request": {
                "handlers": handlers,
                "level": "ERROR",
                "propagate": False,
            },
            "celery": {
                "handlers": handlers,
                "level": log_level,
                "propagate": False,
            },
        },
    }

    if log_dir:
        config["handlers"]["file"] = {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": os.path.join(log_dir, f"{module_name}.log"),
            "maxBytes": 10 * 1024 * 1024,  # 10 MB
            "backupCount": 5,
            "formatter": "verbose",
            "level": log_level,
        }

    return config
