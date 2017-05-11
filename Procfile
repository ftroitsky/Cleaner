bot: node server.js
dev: supervisor server.js

setup-deploy: rm -rf dist && git clone ssh://deployer@cleaner.argh.team/home/deployer/repos/cleaner.git dist && chmod +x deploy
deploy: ./deploy ssh://deployer@cleaner.argh.team/home/deployer/repos/cleaner.git