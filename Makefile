.PHONY: clean test

default:
	node index.js

clean:
	rm -f out/lib/*.js out/json/*.json

lint:
	node_modules/jshint/bin/jshint --verbose index.js lib

lintOut:
	node_modules/jshint/bin/jshint --verbose out/lib

test: lint
	node_modules/mocha/bin/mocha --reporter=spec --ui tdd
