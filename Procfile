bot: ./bin/cleaner_bot
dev: supervisor ./bin/cleaner_bot

setup-deploy: rm -rf dist && git clone ssh://deployer@cleaner.argh.team/home/deployer/repos/cleaner.git dist && chmod +x deploy
deploy: ./deploy ssh://deployer@cleaner.argh.team/home/deployer/repos/cleaner.git