import io
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

from PIL import Image
from sqlalchemy import select

from app.database import SessionLocal
from app.models import Flashcard


def card(front='Question', back='Answer'):
    return dict(front_type='text', front_content=front, front_instruction='Think first',
                back_type='text', back_content=back, back_explanation='Well done')


def add_card(client, set_id, **kwargs):
    response = client.post(f'/api/sets/{set_id}/cards', json=card(**kwargs))
    assert response.status_code == 201, response.text
    return response.json()


def test_health_checks_real_database(client):
    assert client.get('/api/health').json() == {'status': 'ok', 'database': 'ok'}


def test_sets_crud_and_persisted_cascade(client, create_set):
    lesson = create_set()
    item = add_card(client, lesson['id'])
    listed = next(x for x in client.get('/api/sets').json() if x['id'] == lesson['id'])
    assert listed['card_count'] == 1
    assert client.get(f"/api/sets/{lesson['id']}").json()['cards'][0]['id'] == item['id']
    response = client.put(f"/api/sets/{lesson['id']}", json={'name': 'Updated', 'description': ''})
    assert response.status_code == 200
    assert response.json()['name'] == 'Updated'
    assert client.delete(f"/api/sets/{lesson['id']}").status_code == 204
    assert client.get(f"/api/sets/{lesson['id']}").status_code == 404
    with SessionLocal() as session:
        assert session.scalar(select(Flashcard).where(Flashcard.id == item['id'])) is None


def test_card_edit_reorder_delete_and_append(client, create_set):
    lesson = create_set()
    url = f"/api/sets/{lesson['id']}/cards"
    cards = [add_card(client, lesson['id'], front=str(n)) for n in range(3)]
    assert [x['position'] for x in cards] == [0, 1, 2]
    changed = client.put(f"{url}/{cards[0]['id']}", json=card('New question', 'New answer'))
    assert changed.status_code == 200
    assert changed.json()['front_content'] == 'New question'
    reversed_ids = [x['id'] for x in reversed(cards)]
    reordered = client.put(f'{url}/reorder', json={'card_ids': reversed_ids})
    assert reordered.status_code == 200
    assert [x['id'] for x in reordered.json()] == reversed_ids
    assert client.delete(f"{url}/{cards[1]['id']}").status_code == 204
    detail = client.get(f"/api/sets/{lesson['id']}").json()
    assert [x['position'] for x in detail['cards']] == [0, 1]
    assert add_card(client, lesson['id'])['position'] == 2


def test_reorder_requires_exact_set_members_and_is_atomic(client, create_set):
    first, second = create_set('First'), create_set('Second')
    a, b = add_card(client, first['id']), add_card(client, first['id'])
    other = add_card(client, second['id'])
    url = f"/api/sets/{first['id']}/cards/reorder"
    for ids in ([a['id']], [a['id'], a['id']], [a['id'], other['id']], [str(uuid4()), b['id']]):
        assert client.put(url, json={'card_ids': ids}).status_code == 422
    assert [x['id'] for x in client.get(f"/api/sets/{first['id']}").json()['cards']] == [a['id'], b['id']]
    assert client.delete(f"/api/sets/{second['id']}/cards/{a['id']}").status_code == 404


def test_parallel_appends_keep_unique_dense_order(client, create_set):
    lesson = create_set('Concurrent additions')
    with ThreadPoolExecutor(max_workers=6) as executor:
        saved = list(executor.map(lambda n: add_card(client, lesson['id'], front=f'Card {n}'), range(12)))
    assert sorted(c['position'] for c in saved) == list(range(12))
    with SessionLocal() as session:
        positions = list(session.scalars(select(Flashcard.position).where(Flashcard.set_id == lesson['id']).order_by(Flashcard.position)))
    assert positions == list(range(12))


def test_input_validation(client, create_set):
    assert client.post('/api/sets', json={'name': '  ', 'description': ''}).status_code == 422
    assert client.post('/api/sets', json={'name': 'a' * 121}).status_code == 422
    lesson = create_set()
    url = f"/api/sets/{lesson['id']}/cards"
    for updates in ({'front_content': '  '}, {'front_type': 'video'}, {'back_content': ''},
                    {'front_type': 'image', 'front_content': 'https://example.com/image.png'}):
        assert client.post(url, json=card() | updates).status_code == 422
    assert client.get(f'/api/sets/{uuid4()}').status_code == 404


def test_text_with_null_characters_is_rejected_before_database_write(client, create_set):
    assert client.post('/api/sets', json={'name': 'Null\u0000name'}).status_code == 422
    assert client.post('/api/sets', json={'name': 'A lesson', 'description': 'Null\u0000description'}).status_code == 422
    lesson = create_set()
    for field in ('front_content', 'front_instruction', 'back_content', 'back_explanation'):
        response = client.post(f"/api/sets/{lesson['id']}/cards", json=card() | {field: 'Null\u0000text'})
        assert response.status_code == 422
    assert client.get(f"/api/sets/{lesson['id']}").json()['cards'] == []


def test_upload_actual_image_and_use_on_both_faces(client, create_set):
    buffer = io.BytesIO()
    Image.new('RGB', (16, 16), 'blue').save(buffer, format='PNG')
    response = client.post('/api/uploads', files={'file': ('picture.png', buffer.getvalue(), 'image/png')})
    assert response.status_code == 201, response.text
    uploaded = response.json()['url']
    try:
        assert client.get(uploaded).status_code == 200
        lesson = create_set()
        image_card = card() | dict(front_type='image', front_content=uploaded, back_type='image', back_content=uploaded)
        saved = client.post(f"/api/sets/{lesson['id']}/cards", json=image_card)
        assert saved.status_code == 201, saved.text
        assert saved.json()['back_content'] == uploaded
    finally:
        from app.config import settings
        (settings.upload_dir / uploaded.rsplit('/', 1)[1]).unlink(missing_ok=True)


def test_reject_bad_uploads(client):
    assert client.post('/api/uploads', files={'file': ('bad.png', b'not a picture', 'image/png')}).status_code == 422
    assert client.post('/api/uploads', files={'file': ('bad.svg', b'<svg/>', 'image/svg+xml')}).status_code == 422
    assert client.post('/api/uploads', files={'file': ('big.png', b'x' * (10 * 1024 * 1024 + 1), 'image/png')}).status_code == 413
