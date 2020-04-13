#!/bin/bash
set -e

pushd token
./build.sh
popd

pushd factory
./build.sh
popd




