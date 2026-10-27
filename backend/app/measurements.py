"""Customer body measurements for smart size recommendation."""
from sqlalchemy.orm import Session
from .models import CustomerMeasurements, as_dict, now


def get_measurements(db: Session, user_id: str):
    row = db.get(CustomerMeasurements, user_id)
    return {'measurements': as_dict(row) if row else None}


def save_measurements(db: Session, user_id: str, values):
    row = db.get(CustomerMeasurements, user_id)
    if not row:
        row = CustomerMeasurements(user_id=user_id)
    row.height = values.height
    row.weight = values.weight
    row.chest = values.chest
    row.waist = values.waist
    row.hips = values.hips
    row.shoulder = values.shoulder
    row.fit_preference = values.fit_preference
    row.updated_at = now()
    db.add(row)
    db.commit()
    return {'measurements': as_dict(row)}
