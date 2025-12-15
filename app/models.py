from pydantic import BaseModel, Field
from typing import List, Dict, Optional

class Product(BaseModel):
    id: int
    name: str
    price: int
    image: str

class SessionData(BaseModel):
    session_id: str
    balance: float = 0.0
    bonus_received: bool = False

class BonusRequest(BaseModel):
    bonus_amount: str

PRODUCTS = [
    Product(id=1, name="Watermelon Rations", price=300, image="watermelon.png"),
    Product(id=2, name="Skipper's Straw Hat", price=120, image="straw_hat.png"),
    Product(id=3, name="Lifebuoy Ring", price=150, image="pool_ring.png"),
    Product(id=4, name="Deckside Cucumber Snack", price=50, image="cucumber_snack.png"),
    Product(id=5, name="Sun Sail Parasol", price=200, image="sun_umbrella.png"),
    Product(id=6, name="Deck Hammock", price=300, image="hammock.png"),
    Product(id=7, name="Comfort & Care Kit", price=250, image="spa_set.png"),
    Product(id=8, name="Portable Water Slide", price=500, image="waterslide.png"),
    Product(id=9, name="Pet Deck Lounger", price=400, image="pet_couch.png"),
    Product(id=10, name="All-Weather Deck Blanket", price=180, image="blanket.png"),
    Product(id=11, name="Waterproof Phone Case", price=500, image="phone_case.png"),
    Product(id=12, name="Anchor", price=15000, image="anchor.png"),
]

class OrderItem(BaseModel):
    product_id: int
    quantity: int

class Order(BaseModel):
    items: List[OrderItem]