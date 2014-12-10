.PHONY: clean

default:
	node index.js

clean:
	rm -f out/txt/*.txt out/lib/*.js

lint:
	node_modules/jshint/bin/jshint --verbose out/lib
