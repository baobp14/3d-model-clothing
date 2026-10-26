import re
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StrictBool, StringConstraints, field_validator, model_validator

Name = Annotated[str, StringConstraints(strict=True, strip_whitespace=True, min_length=1, max_length=160)]
Price = Annotated[int, Field(strict=True, ge=0, le=9007199254740991)]
Stock = Annotated[int, Field(strict=True, ge=0, le=2147483647)]


class Input(BaseModel):
    model_config = ConfigDict(extra='forbid')


class Address(Input):
    name: str
    email: str
    phone: str
    city: str
    address: str
    notes: str = ''

    @field_validator('*', mode='before')
    @classmethod
    def normalize(cls, value):
        if not isinstance(value, str):
            raise ValueError('NB_INVALID_ADDRESS')
        return re.sub(r'(?m)^ +', '', re.sub(r'[^\S\r\n]+', ' ', value)).strip()

    @model_validator(mode='after')
    def validate_address(self):
        for field, limit in {'name': 120, 'email': 120, 'phone': 10, 'city': 120, 'address': 300, 'notes': 500}.items():
            value = getattr(self, field)
            if len(value) > limit or (field != 'notes' and not value):
                raise ValueError('NB_INVALID_ADDRESS')
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', self.email) or not re.fullmatch(r'0[0-9]{9}', self.phone):
            raise ValueError('NB_INVALID_ADDRESS')
        return self


class AddressMutation(Input):
    action: Literal['save', 'default', 'delete']
    address: Address | None = None
    id: UUID | None = None
    make_default: StrictBool = False
    expected_revision: Annotated[int, Field(strict=True, ge=0)]

    @model_validator(mode='after')
    def validate_action(self):
        if self.action == 'save' and self.address is None:
            raise ValueError('NB_INVALID_ADDRESS')
        if self.action != 'save' and self.id is None:
            raise ValueError('NB_ADDRESS_NOT_FOUND')
        return self


class ProductCreate(Input):
    request_id: UUID | None = None
    name_en: Name | None = None
    name: Name
    category: Annotated[str, StringConstraints(strict=True, min_length=1, max_length=100)]
    price: Price
    stock: Stock
    image: Annotated[str, StringConstraints(strict=True, max_length=3000000)]

    @field_validator('image')
    @classmethod
    def validate_image(cls, value):
        if not re.match(r'^(https?://|/img/|data:image/(png|jpeg|webp);base64,)', value):
            raise ValueError('NB_INVALID_PRODUCT')
        return value


class ProductExpected(Input):
    name_en: Name | None = None
    description_en: Annotated[str, StringConstraints(strict=True, max_length=5000)] | None = None
    colors: list[str] | None = None
    sizes: list[str] | None = None
    images: list[str] | None = None
    name: Name
    price: Price
    stock: Stock
    description: Annotated[str, StringConstraints(strict=True, max_length=5000)]


class ProductUpdate(Input):
    reason: Annotated[str, StringConstraints(strict=True, max_length=300)] = ''
    name_en: Name | None = None
    description_en: Annotated[str, StringConstraints(strict=True, max_length=5000)] | None = None
    colors: Annotated[list[Annotated[str, StringConstraints(strict=True, min_length=1, max_length=100)]], Field(max_length=30)] | None = None
    sizes: Annotated[list[Annotated[str, StringConstraints(strict=True, min_length=1, max_length=30)]], Field(max_length=30)] | None = None
    images: Annotated[list[Annotated[str, StringConstraints(strict=True, max_length=3000000)]], Field(max_length=12)] | None = None
    name: Name
    price: Price
    stock: Stock
    description: Annotated[str, StringConstraints(strict=True, max_length=5000)]
    expected: ProductExpected

    @model_validator(mode='after')
    def validate_options(self):
        for field in ('colors', 'sizes'):
            value = getattr(self, field)
            if value is not None and len(set(value)) != len(value):
                raise ValueError('NB_INVALID_PRODUCT')
        for image in self.images or []:
            ProductCreate.validate_image(image)
        for field in ('name_en', 'description_en', 'colors', 'sizes', 'images'):
            if getattr(self, field) is not None and getattr(self.expected, field) is None:
                raise ValueError('NB_INVALID_PRODUCT')
        return self


class OrderItem(Input):
    expected_price: Price | None = None
    product_id: Annotated[int, Field(strict=True, ge=1, le=9007199254740991)]
    quantity: Annotated[int, Field(strict=True, ge=1, le=99)]
    color: Annotated[str, StringConstraints(strict=True, max_length=100)] = ''
    size: Annotated[str, StringConstraints(strict=True, max_length=30)] = ''


class OrderCreate(Input):
    promotion_code: Annotated[str, StringConstraints(strict=True, pattern=r'^[A-Z0-9_-]{0,30}$')] = ''
    expected_discount: Price | None = None
    items: Annotated[list[OrderItem], Field(min_length=1, max_length=200)]
    address_id: UUID
    payment: Literal['cod', 'qr']
    request_id: UUID


class OrderStatus(Input):
    status: Literal['confirmed', 'shipped', 'delivered', 'canceled']
    expected_status: Literal['pending', 'confirmed', 'shipped', 'delivered', 'canceled']


class PromotionInput(Input):
    code: Annotated[str, StringConstraints(strict=True, pattern=r'^[A-Z0-9_-]{1,30}$')]
    percent: Annotated[int, Field(strict=True, ge=1, le=80)]
    active: StrictBool
    ends_at: AwareDatetime | None = None
    max_uses: Annotated[int, Field(strict=True, ge=1, le=10000000)] | None = None
    min_subtotal: Price = 0
    expected: dict | None = None

    def expected_rules(self):
        """The previously loaded row, normalized like promotion_dict; rule fields default to 'no limit'."""
        if self.expected is None:
            return None
        row = {'ends_at': None, 'max_uses': None, 'min_subtotal': 0,
               **{key: self.expected.get(key) for key in ('code', 'percent', 'active', 'ends_at', 'max_uses', 'min_subtotal') if key in self.expected}}
        if isinstance(row['ends_at'], str):
            try:
                row['ends_at'] = datetime.fromisoformat(row['ends_at'].replace('Z', '+00:00'))
            except ValueError:
                pass
        return row


class WishlistInput(Input):
    product_id: Annotated[int, Field(strict=True, ge=1, le=9007199254740991)]
    saved: StrictBool


class VariantStock(Input):
    color: Annotated[str, StringConstraints(strict=True, max_length=100)] = ''
    size: Annotated[str, StringConstraints(strict=True, max_length=30)] = ''
    stock: Stock


class VariantConfigure(Input):
    reason: Annotated[str, StringConstraints(strict=True, max_length=300)] = ''
    variants: Annotated[list[VariantStock], Field(min_length=1, max_length=900)]
    expected_revision: Annotated[int, Field(strict=True, ge=0)] | None
    expected_stock: Stock


class DemoMark(Input):
    is_test: StrictBool
    expected_is_test: StrictBool


class ReadNotifications(Input):
    keys: Annotated[list[Annotated[str, StringConstraints(strict=True, min_length=1, max_length=250)]], Field(min_length=1, max_length=100)]


class PaymentReceive(Input):
    received: Literal[True]


class RefundComplete(Input):
    refunded: Literal[True]


class ArchiveInput(Input):
    archived: StrictBool
    reason: Annotated[str, StringConstraints(strict=True, max_length=300)] = ''


class ReviewCreate(Input):
    order_id: UUID
    rating: Annotated[int, Field(strict=True, ge=1, le=5)]
    comment: Annotated[str, StringConstraints(strict=True, strip_whitespace=True, max_length=1000)] = ''


class ReturnCreate(Input):
    reason: Annotated[str, StringConstraints(strict=True, strip_whitespace=True, min_length=5, max_length=1000)]


class ReturnDecision(Input):
    action: Literal['approve', 'reject', 'receive']
    expected_status: Literal['pending', 'approved']
    restock: StrictBool = False
    note: Annotated[str, StringConstraints(strict=True, strip_whitespace=True, max_length=500)] = ''


class UserLock(Input):
    locked: StrictBool


Measure = Annotated[float, Field(gt=0, lt=300)]


class SizeMeasures(Input):
    label: Annotated[str, StringConstraints(strict=True, strip_whitespace=True, max_length=20)] = ''
    chestCircCm: Measure | None = None
    bodyLengthCm: Measure | None = None
    waistCircCm: Measure | None = None
    hipCircCm: Measure | None = None
    inseamCm: Measure | None = None


class SizeChartInput(Input):
    source: Literal['brand', 'measured']
    brand_chart: Annotated[str, StringConstraints(strict=True, pattern=r'^[a-z0-9_]{0,60}$')] = ''
    kind: Literal['tshirt', 'pants', 'shorts', 'skirt']
    sizes: dict[Literal['S', 'M', 'L', 'XL'], SizeMeasures]
    note: Annotated[str, StringConstraints(strict=True, strip_whitespace=True, max_length=300)] = ''

    @model_validator(mode='after')
    def validate_chart(self):
        if self.source == 'brand' and not self.brand_chart:
            raise ValueError('NB_INVALID_SIZE_CHART')
        needed = {'tshirt': ('chestCircCm', 'bodyLengthCm'), 'pants': ('waistCircCm',), 'shorts': ('waistCircCm',), 'skirt': ('waistCircCm',)}[self.kind]
        if not self.sizes or any(getattr(m, key) is None for m in self.sizes.values() for key in needed):
            raise ValueError('NB_INVALID_SIZE_CHART')
        return self
