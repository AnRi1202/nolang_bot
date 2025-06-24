# ベースは python:3.12-slim
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1
WORKDIR /opt/nolang-bot

# bashをデフォルトシェルに設定
SHELL ["/bin/bash", "-c"]

# VS Code Server で必要になるツール類
RUN apt-get update && apt-get install -y git curl build-essential \
    && rm -rf /var/lib/apt/lists/*

# Poetry をインストール
RUN pip install poetry

# Poetry の設定（仮想環境を作成しない）
RUN poetry config virtualenvs.create false

# pyproject.toml と poetry.lock をコピー
COPY pyproject.toml poetry.lock* ./

# 依存関係のみをインストール（プロジェクト自体は除く）
RUN poetry install --only=main --no-root

# プロジェクトファイル全体をコピー
COPY . .

# 開発ユーザーを作成し、/opt/nolang-botの所有権を変更
RUN useradd -m dev -s /bin/bash && chown -R dev /opt/nolang-bot
USER dev

# bashを使用
CMD ["/bin/bash"]