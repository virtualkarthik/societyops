from typing import Optional
from pydantic import BaseModel


class BlockCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True


class BlockUpdate(BlockCreate):
    name: Optional[str] = None


class BlockOut(BlockCreate):
    id: int
    society_id: int

    model_config = {"from_attributes": True}


class FloorCreate(BaseModel):
    block_id: int
    name: str
    description: Optional[str] = None
    is_active: bool = True


class FloorUpdate(FloorCreate):
    block_id: Optional[int] = None
    name: Optional[str] = None


class FloorOut(FloorCreate):
    id: int
    society_id: int

    model_config = {"from_attributes": True}


class CommonAreaCreate(BaseModel):
    name: str
    block_id: Optional[int] = None
    description: Optional[str] = None
    is_active: bool = True


class CommonAreaUpdate(CommonAreaCreate):
    name: Optional[str] = None


class CommonAreaOut(CommonAreaCreate):
    id: int
    society_id: int

    model_config = {"from_attributes": True}
