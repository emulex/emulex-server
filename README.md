emulex-server
===

### Dependences
* boost
* sqlite3
* node

### Install
* install `boost` `node` `sqlite3`
* clone source

```
mkdir ~/emulex
cd ~/emulex/
git clone https://github.com/emulex/libed2k.git
git clone https://github.com/emulex/libtorrent.git
git clone https://github.com/emulex/libemulex.git
git clone https://github.com/emulex/libemulex-node.git
git clone https://github.com/emulex/emulex-server.git
```
* compile libed2k/libtorrent/libemulex

```

cd ~/emulex/libed2k
mkdir build
cd build
cmake ..
make -j 5
make install

cd ~/emulex/libtorrent
mkdir build
cd build
cmake ..
make -j 5
make install

cd ~/emulex/libemulex
mkdir build
cd build
cmake ..
make -j 5
make install

```

* npm install

```

cd ~/emulex/emulex-server
npm install

```


### Run

* run server
```
cd ~/emulex/emulex-server
node bin/main.js
```