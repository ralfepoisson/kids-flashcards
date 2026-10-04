from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class FlashcardSet(Base):
    __tablename__ = 'flashcard_sets'

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(String(2000), default='')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, server_default='false')
    owner_subject: Mapped[str | None] = mapped_column(String(200), nullable=True)
    owner_account_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    cards: Mapped[list['Flashcard']] = relationship(
        back_populates='set', cascade='all, delete-orphan', passive_deletes=True, order_by='Flashcard.position'
    )


class Flashcard(Base):
    __tablename__ = 'flashcards'
    __table_args__ = (
        UniqueConstraint('set_id', 'position', name='uq_flashcard_set_position', deferrable=True, initially='DEFERRED'),
        CheckConstraint('position >= 0', name='ck_flashcard_position'),
        CheckConstraint("front_type IN ('text', 'image')", name='ck_flashcard_front_type'),
        CheckConstraint("back_type IN ('text', 'image')", name='ck_flashcard_back_type'),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    set_id: Mapped[UUID] = mapped_column(ForeignKey('flashcard_sets.id', ondelete='CASCADE'), index=True)
    position: Mapped[int]
    front_type: Mapped[str] = mapped_column(String(5))
    front_content: Mapped[str] = mapped_column(String(10000))
    front_instruction: Mapped[str] = mapped_column(String(2000), default='')
    back_type: Mapped[str] = mapped_column(String(5))
    back_content: Mapped[str] = mapped_column(String(10000))
    back_explanation: Mapped[str] = mapped_column(String(2000), default='')
    set: Mapped[FlashcardSet] = relationship(back_populates='cards')


class PictureUpload(Base):
    __tablename__ = 'picture_uploads'

    filename: Mapped[str] = mapped_column(String(100), primary_key=True)
    owner_subject: Mapped[str] = mapped_column(String(200))
    owner_account_id: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
