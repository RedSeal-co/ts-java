.PHONY: install install-npm install-tsd documentation test testdata unittest
.PHONY: clean clean-obj clean-tsd clean-npm clean-js-map clean-unittest
.PHONY: install-java-pkgs clean-java-pkgs
.PHONY: cucumber clean-cucumber

default: test

##### typescript sources #####

ALL_TS_SRC=$(filter-out %.d.ts,$(wildcard bin/*.ts lib/*.ts test/*.ts features/step_definitions/*.ts))
ALL_TS_OBJ=$(patsubst %.ts,%.js,$(ALL_TS_SRC))
ALL_TS_JSMAP=$(patsubst %.ts,%.js.map,$(ALL_TS_SRC))

STEPS_SRC=$(wildcard features/step_definitions/*.ts)
STEPS_OBJS=$(patsubst %.ts,%.js,$(STEPS_SRC))

LIBS_SRC=$(filter-out %.d.ts,$(wildcard lib/*.ts))
LIBS_OBJS=$(patsubst %.ts,%.js,$(LIBS_SRC))

LINT=./node_modules/.bin/tslint --config tslint.json --file

TSC=./node_modules/.bin/tsc
TSC_OPTS=--module commonjs --target ES5 --sourceMap --noEmitOnError --noImplicitAny

%.js: %.ts
	($(TSC) $(TSC_OPTS) $< && $(LINT) $<) || (rm -f $@ && false)

compile: $(ALL_TS_OBJ)

.PHONY: compile

######
# JAVAPKGS are directories containing a pom.xml and a package.json in which ts-java will be run
# to generate a java.d.ts file. Keep the packages in alphabetical order.
JAVAPKGS=\
	hellojava \
	featureset \
	reflection \
	tinkerpop \

##### java packages: clean package artifacts #####

# hellojava-clean
JAVAPKGS_CLEAN=$(patsubst %,%-clean,$(JAVAPKGS))

clean-java-pkgs : $(JAVAPKGS_CLEAN)

.PHONY: $(JAVAPKGS_CLEAN)

##### java packages: maven build rules #####

# all java source files across all pacakges
ALL_JAVA_SOURCES=$(shell find */src -name '*.java')

# hellojava/o/maven.lastran
JAVAPKGS_INSTALL=$(patsubst %,%/o/maven.lastran,$(JAVAPKGS))

$(JAVAPKGS_INSTALL): %/o/maven.lastran: %/pom.xml $(ALL_JAVA_SOURCES)
	cd $* && mvn clean package
	mkdir -p $(dir $@) && touch  $@

install-java-pkgs : $(JAVAPKGS_INSTALL)

##### java packages: java.d.ts rules #####

# The java.d.ts file for each java package, e.g.: hellojava/java.d.ts
JAVAPKGS_JAVADTS=$(patsubst %,%/java.d.ts,$(JAVAPKGS))

# The rule to update each java.d.ts file
$(JAVAPKGS_JAVADTS): %/java.d.ts: %/package.json %/o/maven.lastran bin/ts-java.sh ts-templates/package.txt ts-templates/autoImport.txt
	cd $* && ../bin/ts-java.sh

$(JAVAPKGS_CLEAN): %-clean:
	cd $* && mvn clean
	rm -rf $*/java.d.ts $*/o

##### java packages: cucumber rules #####

# A list of all .feature files (not organized by java packages)
ALL_CUCUMBER_FEATURES=$(wildcard */features/*.feature)

# The corresponding list of feature .lastran marker files
ALL_CUCUMBER_FEATURES_RAN=$(patsubst %.feature,o/%.lastran,$(ALL_CUCUMBER_FEATURES))

# A rule to make sure that every feature file is run
$(ALL_CUCUMBER_FEATURES_RAN): o/%.lastran : %.feature $(STEPS_OBJS) $(LIBS_OBJS) $(JAVAPKGS_JAVADTS) $(UNIT_TEST_RAN)
	./node_modules/.bin/cucumber-js --format summary --tags '~@todo' --require features/step_definitions $<
	mkdir -p $(dir $@) && touch  $@

# A convenience target
cucumber : o/cucumber.lastran

# Run all out of date cucumber feature tests
o/cucumber.lastran: $(ALL_CUCUMBER_FEATURES_RAN)
	mkdir -p $(dir $@) && touch  $@

clean-cucumber:
	rm -rf $(ALL_CUCUMBER_FEATURES_RAN) o/cucumber.lastran

###
UNIT_TESTS=$(filter-out %.d.ts, $(wildcard test/*.ts))
UNIT_TEST_OBJS=$(patsubst %.ts,%.js,$(UNIT_TESTS))
UNIT_TEST_RAN=$(patsubst %.ts,o/%.lastran,$(UNIT_TESTS))

$(UNIT_TEST_RAN): o/%.lastran: %.js $(LIBS_OBJS)
	node_modules/mocha/bin/mocha --timeout 20s --reporter=spec --ui tdd $<
	mkdir -p $(dir $@) && touch  $@

#####
all:
	$(MAKE) install
	$(MAKE) test documentation

documentation :
	node_modules/groc/bin/groc --except "**/node_modules/**" --except "o/**" --except "**/o/**" --except "**/*.d.ts" "**/*.ts" README.md

test: unittest cucumber
	# Test that lib/java.d.ts is up to date. If there are differences, manually update using 'make lib-java-dts'.
	diff -q lib/java.d.ts reflection/java.d.ts

lib-java-dts:
	cp reflection/java.d.ts lib/java.d.ts
	$(MAKE) test

unittest: $(UNIT_TEST_RAN)


clean: clean-cucumber clean-doc clean-js-map clean-npm clean-obj clean-tsd clean-unittest clean-java-pkgs

clean-doc:
	rm -rf doc

clean-js-map:
	rm -f $(ALL_TS_JSMAP)

clean-npm:
	rm -rf node_modules

clean-obj:
	rm -f $(ALL_TS_OBJ)

clean-tsd:
	rm -rf typings

clean-unittest:
	rm -rf o/* test/*.lastran

install: install-tsd install-java-pkgs

install-npm:
	npm install

TSD=./node_modules/.bin/tsd

install-tsd: install-npm
	$(TSD) reinstall

update-tsd:
	$(TSD) update -o -s

# Explicit dependencies for files that are referenced

bin/ts-java.sh: bin/ts-java.js lib/java.d.ts
	touch $@

bin/ts-java.js : $(LIBS_OBJS)

lib/classes-map.js : lib/paramcontext.ts

lib/code-writer.js : lib/classes-map.ts

test/classes-map-test.js : lib/paramcontext.ts
