from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from datetime import datetime
import os
from openai import OpenAI
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

print("OPENAI_API_KEY =", os.getenv('OPENAI_API_KEY'))

app = Flask(__name__)
CORS(app)

# Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///data/forum.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'votre_cle_secrete')  # À changer en production

# Configuration OpenAI
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

db = SQLAlchemy(app)
jwt = JWTManager(app)

# Modèles
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # 'teacher' ou 'student'

class Discussion(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    teacher_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    discussion_id = db.Column(db.Integer, db.ForeignKey('discussion.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    is_bot = db.Column(db.Boolean, default=False)

# Routes pour l'authentification
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 400
    
    new_user = User(
        username=data['username'],
        password=data['password'],  # Dans un vrai projet, il faudrait hasher le mot de passe
        role=data['role']
    )
    db.session.add(new_user)
    db.session.commit()
    return jsonify({'message': 'User created successfully'}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(username=data['username']).first()
    if user and user.password == data['password']:  # Dans un vrai projet, vérifier le hash
        access_token = create_access_token(identity=user.id)
        return jsonify({
            'access_token': access_token,
            'role': user.role,
            'id': user.id
        })
    return jsonify({'error': 'Invalid credentials'}), 401

# Routes pour les discussions
@app.route('/api/discussions', methods=['GET'])
@jwt_required()
def get_discussions():
    discussions = Discussion.query.all()
    return jsonify([{
        'id': d.id,
        'title': d.title,
        'content': d.content,
        'created_at': d.created_at.isoformat(),
        'teacher_id': d.teacher_id
    } for d in discussions])

@app.route('/api/discussions', methods=['POST'])
@jwt_required()
def create_discussion():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if user.role != 'teacher':
        return jsonify({'error': 'Only teachers can create discussions'}), 403
    
    data = request.get_json()
    new_discussion = Discussion(
        title=data['title'],
        content=data['content'],
        teacher_id=current_user_id
    )
    db.session.add(new_discussion)
    db.session.commit()
    return jsonify({'message': 'Discussion created successfully'}), 201

# Routes pour les messages
@app.route('/api/discussions/<int:discussion_id>/messages', methods=['GET'])
@jwt_required()
def get_messages(discussion_id):
    messages = Message.query.filter_by(discussion_id=discussion_id).all()
    response_data = []
    for m in messages:
        user = User.query.get(m.user_id)
        username = user.username if user and not m.is_bot else 'Bot'
        print(f"Message {m.id}: user_id={m.user_id}, username={username}")  # Debug log
        response_data.append({
            'id': m.id,
            'content': m.content,
            'created_at': m.created_at.isoformat(),
            'user_id': m.user_id,
            'is_bot': m.is_bot,
            'username': username
        })
    return jsonify(response_data)

@app.route('/api/discussions/<int:discussion_id>/messages', methods=['POST'])
@jwt_required()
def create_message(discussion_id):
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    new_message = Message(
        content=data['content'],
        discussion_id=discussion_id,
        user_id=current_user_id
    )
    db.session.add(new_message)
    
    # Vérifier si le message contient @bot
    if '@bot' in data['content'].lower():
        try:
            # Récupérer le contexte de la conversation
            messages = Message.query.filter_by(discussion_id=discussion_id).order_by(Message.created_at.desc()).limit(5).all()
            messages.reverse()  # Pour avoir l'ordre chronologique
            
            # Préparer le contexte pour OpenAI
            conversation = []
            for msg in messages:
                role = "assistant" if msg.is_bot else "user"
                conversation.append({"role": role, "content": msg.content})
            
            # Ajouter le message actuel
            conversation.append({"role": "user", "content": data['content']})
            
            # Appeler l'API OpenAI
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=conversation,
                max_tokens=150,
                temperature=0.7
            )
            
            bot_response = Message(
                content=response.choices[0].message.content,
                discussion_id=discussion_id,
                user_id=current_user_id,
                is_bot=True
            )
            db.session.add(bot_response)
            
        except Exception as e:
            print(f"Error with OpenAI API: {str(e)}")
            # En cas d'erreur, utiliser une réponse par défaut
            bot_response = Message(
                content="Désolé, je ne peux pas répondre pour le moment. Veuillez réessayer plus tard.",
                discussion_id=discussion_id,
                user_id=current_user_id,
                is_bot=True
            )
            db.session.add(bot_response)
    
    db.session.commit()
    return jsonify({'message': 'Message created successfully'}), 201

if __name__ == '__main__':
    # Créer le dossier data s'il n'existe pas
    os.makedirs('data', exist_ok=True)
    
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', port=5000, debug=False) 