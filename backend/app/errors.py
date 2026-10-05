from fastapi import HTTPException


def fail(code, status=422):
    raise HTTPException(status_code=status, detail=code)
