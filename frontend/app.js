// Configuração da API
const API_BASE_URL = "http://localhost:3000/api";

// Criar partículas animadas no fundo
function createParticles() {
  const bg = document.getElementById("animatedBg");
  const particleCount = 50;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement("div");
    particle.classList.add("particle");

    // Tamanho aleatório
    const size = Math.random() * 4 + 2;
    particle.style.width = size + "px";
    particle.style.height = size + "px";

    // Posição aleatória
    particle.style.left = Math.random() * 100 + "%";
    particle.style.top = Math.random() * 100 + "%";

    // Delay de animação aleatório
    particle.style.animationDelay = Math.random() * 15 + "s";
    particle.style.animationDuration = Math.random() * 10 + 10 + "s";

    bg.appendChild(particle);
  }
}

// Função para mostrar seções específicas
function showSection(sectionId) {
  // Remove a classe 'active' de todas as seções
  const sections = document.querySelectorAll("section");
  sections.forEach((section) => {
    section.classList.remove("active");
  });

  // Adiciona a classe 'active' na seção selecionada
  const targetSection = document.getElementById(sectionId);
  if (targetSection) {
    targetSection.classList.add("active");
  }
}

// Header com efeito de scroll
window.addEventListener("scroll", () => {
  const header = document.getElementById("header");
  if (window.scrollY > 50) {
    header.classList.add("scrolled");
  } else {
    header.classList.remove("scrolled");
  }
});

// Função para mostrar notificação
function showNotification(message, type = "success") {
  // Remove notificação existente
  const existingNotification = document.querySelector(".notification");
  if (existingNotification) {
    existingNotification.remove();
  }

  // Cria nova notificação
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${
              type === "success" ? "✅" : "❌"
            }</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;

  // Adiciona estilos inline
  notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${
          type === "success"
            ? "var(--gradient-primary)"
            : "linear-gradient(135deg, #ff4757, #ff3742)"
        };
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        z-index: 9999;
        max-width: 400px;
        animation: slideInRight 0.3s ease;
        font-family: inherit;
    `;

  document.body.appendChild(notification);

  // Remove automaticamente após 5 segundos
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = "slideOutRight 0.3s ease";
      setTimeout(() => notification.remove(), 300);
    }
  }, 5000);
}

// Função para enviar dados para a API
async function enviarContato(dados) {
  try {
    const response = await fetch(`${API_BASE_URL}/contato`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dados),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Erro ao enviar mensagem");
    }

    return result;
  } catch (error) {
    console.error("Erro na API:", error);
    throw error;
  }
}

// Event listener para o formulário de contato
document
  .getElementById("contactForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    // Captura os valores dos campos
    const nome = document.getElementById("nome").value.trim();
    const email = document.getElementById("email").value.trim();
    const empresa = document.getElementById("empresa").value.trim();
    const mensagem = document.getElementById("mensagem").value.trim();

    // Validação básica
    if (!nome || !email || !mensagem) {
      showNotification(
        "Por favor, preencha todos os campos obrigatórios.",
        "error"
      );
      return;
    }

    // Validação de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showNotification("Por favor, digite um email válido.", "error");
      return;
    }

    // Efeito de loading no botão
    const btn = document.querySelector(".btn-submit");
    const originalText = btn.textContent;
    btn.textContent = "Enviando...";
    btn.disabled = true;

    try {
      // Enviar para a API
      const dados = { nome, email, empresa, mensagem };
      const result = await enviarContato(dados);

      // Sucesso
      showNotification(`Obrigado ${nome}! ${result.message}`, "success");
      this.reset();
    } catch (error) {
      // Erro
      let errorMessage = "Erro ao enviar mensagem. Tente novamente mais tarde.";

      if (error.message.includes("Muitas tentativas")) {
        errorMessage =
          "Muitas tentativas de contato. Tente novamente em alguns minutos.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      showNotification(errorMessage, "error");
    } finally {
      // Restaurar botão
      btn.textContent = originalText;
      btn.disabled = false;
    }
  });

// Efeitos interativos para os cards de projeto
document.querySelectorAll(".project-card").forEach((card) => {
  card.addEventListener("mouseenter", function () {
    this.style.transform = "translateY(-10px) rotateX(5deg)";
  });

  card.addEventListener("mouseleave", function () {
    this.style.transform = "translateY(0) rotateX(0deg)";
  });
});

// Efeito de parallax suave
window.addEventListener("scroll", () => {
  const scrolled = window.pageYOffset;
  const parallax = document.querySelector(".profile-glow");
  if (parallax) {
    const speed = scrolled * 0.5;
    parallax.style.transform = `translateY(${speed}px)`;
  }
});

// Inicializar partículas quando a página carregar
document.addEventListener("DOMContentLoaded", () => {
  createParticles();

  // Animação de entrada para elementos
  const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px",
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
      }
    });
  }, observerOptions);

  // Observar elementos para animação
  document
    .querySelectorAll(
      ".timeline-item, .project-card, .tech-item, .contact-card"
    )
    .forEach((el) => {
      el.style.opacity = "0";
      el.style.transform = "translateY(30px)";
      el.style.transition = "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)";
      observer.observe(el);
    });

  // Verificar se a API está funcionando
  checkAPIHealth();
});

// Função para verificar se a API está funcionando
async function checkAPIHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    const result = await response.json();

    if (result.success) {
      console.log("✅ API conectada com sucesso");
    }
  } catch (error) {
    console.warn("⚠️ API não está disponível. Formulário funcionará offline.");

    // Fallback para funcionamento offline
    document
      .getElementById("contactForm")
      .addEventListener("submit", function (e) {
        e.preventDefault();
        showNotification(
          "Formulário em modo offline. Entre em contato diretamente pelo email.",
          "error"
        );
      });
  }
}

// Adicionar tags de projeto dinamicamente
const projectTags = document.querySelectorAll(".project-tags");
projectTags.forEach((tagContainer) => {
  const tags = tagContainer.querySelectorAll(".tag");
  tags.forEach((tag, index) => {
    tag.style.animationDelay = `${index * 0.1}s`;
    tag.style.animation = "slideInFromBottom 0.5s ease forwards";
  });
});

// CSS para notificações e tags animadas
const style = document.createElement("style");
style.textContent = `
    .project-tags {
        display: flex;
        gap: 0.5rem;
        margin-top: 1rem;
        flex-wrap: wrap;
    }
    
    .tag {
        background: var(--gradient-primary);
        color: white;
        padding: 0.3rem 0.8rem;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 500;
        opacity: 0;
        transform: translateY(20px);
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    .notification-close {
        background: none;
        border: none;
        color: white;
        font-size: 1.2rem;
        cursor: pointer;
        padding: 0;
        margin-left: auto;
    }
    
    @keyframes slideInFromBottom {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(100%);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes slideOutRight {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100%);
        }
    }
`;
document.head.appendChild(style);
