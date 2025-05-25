# install nodejs

echo "Installing Node.js and Yarn..."

sudo apt-get update

sudo apt-get remove -y nodejs
sudo apt-get purge -y nodejs
sudo apt-get autoremove -y

# Install Node.js 20 (official NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo apt-get install -y npm
sudo npm install -g yarn

# install rust & cargo

echo "Installing Rust and Cargo..."

curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source $HOME/.cargo/env
rustup install 1.86.0
rustup default 1.86.0

# yarn install
echo "Installing Yarn packages..."
yarn install

# build native
echo "Building native modules..."
yarn affine @affine/server-native build

# build reader
echo "Building reader..."
yarn affine @affine/reader build

# init server
echo "Initializing server..."
yarn affine server init

echo "Node version in PATH: $(which node)"
node -v