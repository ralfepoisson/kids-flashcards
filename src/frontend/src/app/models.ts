export type FaceType = 'text' | 'image';
export interface CardInput {
  front_type: FaceType;
  front_content: string;
  front_instruction: string;
  back_type: FaceType;
  back_content: string;
  back_explanation: string;
}
export interface Flashcard extends CardInput {
  id: string;
  set_id: string;
  position: number;
}
export interface FlashcardSet {
  id: string;
  name: string;
  description: string;
  card_count: number;
  created_at: string;
  is_public: boolean;
  can_edit: boolean;
}
export interface AuthUser {
  subject: string;
  accountId: string;
  displayName: string;
  email: string;
}
export interface SetDetail extends FlashcardSet {
  cards: Flashcard[];
}
