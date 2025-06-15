// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const path = require('path');

// Importar middleware de autenticação
const { authenticateToken, generateToken, validateAdminCredentials } = require('./middleware/auth');

// Carregar variáveis de ambiente
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares de segurança
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true
}));

// Rate limiting para contatos
const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // máximo 5 tentativas por IP
    message: {
        error: 'Muitas tentativas de contato. Tente novamente em 15 minutos.'
    }
});

// Rate limiting para login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // máximo 5 tentativas por IP
    message: {
        error: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
    }
});

// Middleware para parsing JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Schema do MongoDB para contatos
const contactSchema = new mongoose.Schema({
    nome: {
        type: String,
        required: [true, 'Nome é obrigatório'],
        trim: true,
        maxlength: [100, 'Nome deve ter no máximo 100 caracteres']
    },
    email: {
        type: String,
        required: [true, 'Email é obrigatório'],
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email inválido']
    },
    empresa: {
        type: String,
        trim: true,
        maxlength: [100, 'Nome da empresa deve ter no máximo 100 caracteres']
    },
    mensagem: {
        type: String,
        required: [true, 'Mensagem é obrigatória'],
        trim: true,
        maxlength: [1000, 'Mensagem deve ter no máximo 1000 caracteres']
    },
    ip: {
        type: String,
        required: true
    },
    userAgent: {
        type: String
    },
    status: {
        type: String,
        enum: ['novo', 'lido', 'respondido'],
        default: 'novo'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Modelo do contato
const Contact = mongoose.model('Contact', contactSchema);

// Função para conectar ao MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/portfolio', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Conectado ao MongoDB');
    } catch (error) {
        console.error('❌ Erro ao conectar ao MongoDB:', error);
        process.exit(1);
    }
};

// Conectar ao banco
connectDB();

// ===== ROTAS PÚBLICAS =====

// Servir painel administrativo
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Rota para enviar contato
app.post('/api/contato', contactLimiter, async (req, res) => {
    try {
        const { nome, email, empresa, mensagem } = req.body;
        
        // Validação adicional
        if (!nome || !email || !mensagem) {
            return res.status(400).json({
                success: false,
                message: 'Nome, email e mensagem são obrigatórios'
            });
        }

        // Criar novo contato
        const novoContato = new Contact({
            nome,
            email,
            empresa: empresa || '',
            mensagem,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent']
        });

        // Salvar no banco
        await novoContato.save();

        // Log do contato recebido
        console.log(`📧 Novo contato recebido: ${nome} - ${email}`);

        res.status(201).json({
            success: true,
            message: 'Mensagem enviada com sucesso! Retornarei o contato em breve.',
            id: novoContato._id
        });

    } catch (error) {
        console.error('❌ Erro ao salvar contato:', error);
        
        // Erro de validação do Mongoose
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Dados inválidos',
                errors
            });
        }

        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor. Tente novamente mais tarde.'
        });
    }
});

// Rota de health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Servidor funcionando!',
        timestamp: new Date().toISOString()
    });
});

// ===== ROTAS DE AUTENTICAÇÃO =====

// Login do admin
app.post('/api/admin/login', loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email e senha são obrigatórios'
            });
        }

        // Validar credenciais
        const isValid = await validateAdminCredentials(email, password);
        
        if (!isValid) {
            return res.status(401).json({
                success: false,
                message: 'Credenciais inválidas'
            });
        }

        // Gerar token
        const token = generateToken({
            id: 'admin',
            email: email,
            role: 'admin'
        });

        res.json({
            success: true,
            message: 'Login realizado com sucesso',
            token,
            user: {
                email: email,
                role: 'admin'
            }
        });

    } catch (error) {
        console.error('❌ Erro no login:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Verificar token
app.get('/api/admin/verify', authenticateToken, (req, res) => {
    res.json({
        success: true,
        message: 'Token válido',
        user: req.user
    });
});

// ===== ROTAS ADMINISTRATIVAS (PROTEGIDAS) =====

// Listar contatos (admin)
app.get('/api/admin/contatos', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        
        const filter = status && status !== 'todos' ? { status } : {};
        
        const contatos = await Contact.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .select('-ip -userAgent'); // Não expor dados sensíveis

        const total = await Contact.countDocuments(filter);

        res.json({
            success: true,
            contatos,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });

    } catch (error) {
        console.error('❌ Erro ao buscar contatos:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar contatos'
        });
    }
});

// Atualizar status do contato
app.patch('/api/admin/contatos/:id/status', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['novo', 'lido', 'respondido'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Status inválido'
            });
        }

        const contato = await Contact.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        if (!contato) {
            return res.status(404).json({
                success: false,
                message: 'Contato não encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Status atualizado com sucesso',
            contato
        });

    } catch (error) {
        console.error('❌ Erro ao atualizar status:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar status'
        });
    }
});

// Estatísticas
app.get('/api/admin/stats', authenticateToken, async (req, res) => {
    try {
        const totalContatos = await Contact.countDocuments();
        const contatosNovos = await Contact.countDocuments({ status: 'novo' });
        const contatosLidos = await Contact.countDocuments({ status: 'lido' });
        const contatosRespondidos = await Contact.countDocuments({ status: 'respondido' });
        
        // Contatos dos últimos 7 dias
        const seteDiasAtras = new Date();
        seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
        const contatosRecentes = await Contact.countDocuments({
            createdAt: { $gte: seteDiasAtras }
        });

        res.json({
            success: true,
            stats: {
                total: totalContatos,
                novos: contatosNovos,
                lidos: contatosLidos,
                respondidos: contatosRespondidos,
                ultimaSemana: contatosRecentes
            }
        });

    } catch (error) {
        console.error('❌ Erro ao buscar estatísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar estatísticas'
        });
    }
});

// Deletar contato
app.delete('/api/admin/contatos/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const contato = await Contact.findByIdAndDelete(id);

        if (!contato) {
            return res.status(404).json({
                success: false,
                message: 'Contato não encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Contato deletado com sucesso'
        });

    } catch (error) {
        console.error('❌ Erro ao deletar contato:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao deletar contato'
        });
    }
});

// Exportar contatos para CSV
app.get('/api/admin/export', authenticateToken, async (req, res) => {
    try {
        const contatos = await Contact.find()
            .sort({ createdAt: -1 })
            .select('-ip -userAgent -__v');

        // Gerar CSV
        const csvHeader = 'Nome,Email,Empresa,Mensagem,Status,Data de Criação\n';
        const csvData = contatos.map(contato => {
            const linha = [
                `"${contato.nome.replace(/"/g, '""')}"`,
                `"${contato.email}"`,
                `"${(contato.empresa || '').replace(/"/g, '""')}"`,
                `"${contato.mensagem.replace(/"/g, '""')}"`,
                `"${contato.status}"`,
                `"${contato.createdAt.toLocaleString('pt-BR')}"`
            ].join(',');
            return linha;
        }).join('\n');

        const csv = csvHeader + csvData;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="contatos-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send('\ufeff' + csv); // BOM para UTF-8

    } catch (error) {
        console.error('❌ Erro ao exportar contatos:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao exportar contatos'
        });
    }
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
    console.error('❌ Erro não tratado:', err);
    res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
    });
});

// Rota 404
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Rota não encontrada'
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`👑 Admin: http://localhost:${PORT}/admin`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🔄 Encerrando servidor...');
    await mongoose.connection.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🔄 Encerrando servidor...');
    await mongoose.connection.close();
    process.exit(0);
});

module.exports = app;