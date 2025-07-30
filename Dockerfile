# ベースは node:18-slim
FROM node:18-slim

ENV NODE_ENV=development

# bashをデフォルトシェルに設定
SHELL ["/bin/bash", "-c"]

# VS Code Server で必要になるツール類 + sudo
RUN apt-get update && apt-get install -y git curl build-essential sudo wget \
    && rm -rf /var/lib/apt/lists/*

# 開発ユーザーを先に作成
RUN useradd -m user -s /bin/bash
# userにsudo権限を付与（パスワードなし）
RUN echo "user ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# 作業ディレクトリを設定し、権限を設定
WORKDIR /home/user/nolang-bot
RUN chown -R user:user /home/user

# ユーザーを切り替え
USER user

# package.json をコピーしてnpm install
COPY --chown=user:user package*.json ./
RUN npm install

# プロジェクトファイル全体をコピー
COPY --chown=user:user . .

# bashを使用
CMD ["/bin/bash"]