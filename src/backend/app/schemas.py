from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TextInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)

    @field_validator('*', check_fields=False)
    @classmethod
    def reject_null_characters(cls, value):
        if isinstance(value, str) and '\x00' in value:
            raise ValueError('Text cannot contain null characters')
        return value


class SetInput(TextInput):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default='', max_length=2000)
    is_public: bool = False


class CardInput(TextInput):
    front_type: Literal['text', 'image']
    front_content: str = Field(min_length=1, max_length=10000)
    front_instruction: str = Field(default='', max_length=2000)
    back_type: Literal['text', 'image']
    back_content: str = Field(min_length=1, max_length=10000)
    back_explanation: str = Field(default='', max_length=2000)


class CardOutput(CardInput):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    set_id: UUID
    position: int


class SetOutput(SetInput):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    can_edit: bool
    card_count: int
    created_at: datetime


class SetDetail(SetOutput):
    cards: list[CardOutput]


class ReorderInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    card_ids: list[UUID]
