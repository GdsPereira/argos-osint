# ==========================================
# Estágio 1: Build da aplicação Angular 19
# ==========================================
FROM node:20-slim AS builder

WORKDIR /app

# Copia dependências do projeto
COPY package.json package-lock.json ./

# Instala as dependências de forma reprodutível
RUN npm ci --prefer-offline --no-audit

# Copia todo o código-fonte do frontend
COPY . .

# Executa o build de produção (gera em dist/insta-analyzer/browser)
RUN npm run build

# ==========================================
# Estágio 2: Servidor Nginx de Produção
# ==========================================
FROM nginx:alpine

# Remove configurações padrão
RUN rm -rf /etc/nginx/conf.d/*

# Copia a configuração customizada do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia os arquivos compilados do Angular para o diretório padrão do Nginx
COPY --from=builder /app/dist/insta-analyzer/browser /usr/share/nginx/html

# Expõe a porta 80
EXPOSE 80

# Checagem de saúde do container
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

# Inicializa o Nginx em primeiro plano
CMD ["nginx", "-g", "daemon off;"]
