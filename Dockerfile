# ベースは python:3.12-slim
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1

# bashをデフォルトシェルに設定
SHELL ["/bin/bash", "-c"]

# VS Code Server で必要になるツール類 + sudo
RUN apt-get update && apt-get install -y git curl build-essential sudo wget \
    && rm -rf /var/lib/apt/lists/*

# 開発ユーザーを先に作成
RUN useradd -m user -s /bin/bash
# userにsudo権限を付与（パスワードなし）
RUN echo "user ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Node.js をインストール
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs

# 作業ディレクトリを設定し、権限を設定
WORKDIR /home/user/nolang-bot
RUN chown -R user:user /home/user

# ユーザーを切り替え
USER user

# package.json と poetry 設定
COPY --chown=user:user package*.json ./
RUN npm install

# Poetry をユーザー権限でインストール
RUN pip install --user poetry
ENV PATH="/home/user/.local/bin:$PATH"

# Poetry の設定（仮想環境を作成しない）
RUN poetry config virtualenvs.create false

# pyproject.toml と poetry.lock をコピー
COPY --chown=user:user pyproject.toml poetry.lock* ./

# 依存関係のみをインストール（プロジェクト自体は除く）
RUN poetry install --only=main --no-root

# プロジェクトファイル全体をコピー
COPY --chown=user:user . .

# bashを使用
CMD ["/bin/bash"]