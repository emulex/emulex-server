#!/bin/bash
set -e
res_prefix=$1
pwd_dir=`pwd`
out_dir=$pwd_dir/out


rm -rf $out_dir
mkdir $out_dir $out_dir/emulex-server $out_dir/emulex-server/ws

cp -rf bin conf db lib package.json $out_dir/emulex-server/
#
cd $out_dir
git clone $res_prefix/libemulex-node
cd $out_dir/emulex-server
cnpm install
sys=`uname`
case $sys in
Darwin)
    cp -f /usr/local/lib/libed2k.dylib $out_dir/emulex-server
    cp -f /usr/local/lib/libemulex.dylib $out_dir/emulex-server
    cp -f /usr/local/lib/libboost_system.dylib* $out_dir/emulex-server
    cp -f /usr/local/lib/libboost_random.dylib* $out_dir/emulex-server
    cp -f /usr/local/lib/libboost_thread.dylib* $out_dir/emulex-server
    cp -f /usr/local/lib/libboost_chrono.dylib* $out_dir/emulex-server
    cp -f /usr/local/lib/libboost_atomic.dylib* $out_dir/emulex-server
    cp -f /usr/local/lib/libboost_iostreams.dylib* $out_dir/emulex-server
    cp -f /usr/local/lib/libboost_filesystem.dylib* $out_dir/emulex-server
    cp -f /usr/local/lib/libboost_timer.dylib* $out_dir/emulex-server
    cp -f /usr/local/lib/libboost_regex.dylib* $out_dir/emulex-server
    ;;
Linux)
    cp -f /usr/local/lib/libed2k.so $out_dir/emulex-server
    cp -f /usr/local/lib/libemulex.so $out_dir/emulex-server
    cp -f /usr/lib/libboost_system.so* $out_dir/emulex-server
    cp -f /usr/lib/libboost_random.so* $out_dir/emulex-server
    cp -f /usr/lib/libboost_thread.so* $out_dir/emulex-server
    cp -f /usr/lib/libboost_chrono.so* $out_dir/emulex-server
    cp -f /usr/lib/libboost_atomic.so* $out_dir/emulex-server
    cp -f /usr/lib/libboost_iostreams.so* $out_dir/emulex-server
    cp -f /usr/lib/libboost_filesystem.so* $out_dir/emulex-server
    cp -f /usr/lib/libboost_timer.so* $out_dir/emulex-server
    cp -f /usr/lib/libboost_regex.so* $out_dir/emulex-server
    ;;
esac

#
mkdir $out_dir/emulex-server/ws/plugins
cd $out_dir/emulex-server/ws/plugins
git clone $res_prefix/emulex-static
#
cd ../../..
zip -r emulex-server.zip emulex-server


