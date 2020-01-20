/**
 * This reveal.js plugin is wrapper around the atom/highlights
 * syntax highlighting library.
 */
(function( root, factory ) {
    if (typeof define === 'function' && define.amd) {
        root.RevealAtomHighlights = factory();
    } else if( typeof exports === 'object' ) {
        module.exports = factory();
    } else {
        // Browser globals (root is window)
        root.RevealAtomHighlights = factory();
    }
}( this, function() {
  // TODO: Remove this and bundle them together
  if (typeof window.atom_highlights === 'undefined') {
    throw new Error('You forgot to add atom-highlights to dependencies');
  }
  var Highlighter = new window.atom_highlights({scopePrefix: "syntax--"});

	// Function to perform a better "data-trim" on code snippets
	// Will slice an indentation amount on each line of the snippet (amount based on the line having the lowest indentation length)
	function betterTrim(snippetEl) {
		// Helper functions
		function trimLeft(val) {
			// Adapted from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/Trim#Polyfill
			return val.replace(/^[\s\uFEFF\xA0]+/g, '');
		}
		function trimLineBreaks(input) {
			var lines = input.split('\n');

			// Trim line-breaks from the beginning
			for (var i = 0; i < lines.length; i++) {
				if (lines[i].trim() === '') {
					lines.splice(i--, 1);
				} else break;
			}

			// Trim line-breaks from the end
			for (var i = lines.length-1; i >= 0; i--) {
				if (lines[i].trim() === '') {
					lines.splice(i, 1);
				} else break;
			}

			return lines.join('\n');
		}

		// Main function for betterTrim()
		return (function(snippetEl) {
			var content = trimLineBreaks(snippetEl.innerHTML);
			var lines = content.split('\n');
			// Calculate the minimum amount to remove on each line start of the snippet (can be 0)
			var pad = lines.reduce(function(acc, line) {
				if (line.length > 0 && trimLeft(line).length > 0 && acc > line.length - trimLeft(line).length) {
					return line.length - trimLeft(line).length;
				}
				return acc;
			}, Number.POSITIVE_INFINITY);
			// Slice each line with this amount
			return lines.map(function(line, index) {
				return line.slice(pad);
			})
			.join('\n');
		})(snippetEl);
	}

  var languagePrefixRe = /\blang(?:uage)?-([\w-]+)\b/i;

  function blockLanguage(block) {
    var i, match, length, _class;
    var classes = block.className + ' ';

    classes += block.parentNode ? block.parentNode.className : '';

    // language-* takes precedence over non-prefixed class names.
    match = languagePrefixRe.exec(classes);
    if (match) {
      // var language = getLanguage(match[1]);
      // if (!language) {
      //   console.warn(LANGUAGE_NOT_FOUND.replace("{}", match[1]));
      //   console.warn("Falling back to no-highlight mode for this block.", block);
      // }
      // return language ? match[1] : 'no-highlight';
      return match[1];
    }

    classes = classes.split(/\s+/);

    for (i = 0, length = classes.length; i < length; i++) {
      _class = classes[i];
      match = languagePrefixRe.exec(_class);
      if (match) {
        // var language = getLanguage(match[1]);
        // if (!language) {
        //   console.warn(LANGUAGE_NOT_FOUND.replace("{}", match[1]));
        //   console.warn("Falling back to no-highlight mode for this block.", block);
        // }
        // return language ? match[1] : 'no-highlight';
        return match[1];
      }

      // if (isNotHighlighted(_class) || getLanguage(_class)) {
      //   return _class;
      // }
    }
  }

	var RevealAtomHighlights = {

		HIGHLIGHT_STEP_DELIMITER: '|',
		HIGHLIGHT_LINE_DELIMITER: ',',
		HIGHLIGHT_LINE_RANGE_DELIMITER: '-',

		init: function() {
			// Read the plugin config options and provide fallbacks
			var config = Reveal.getConfig().highlight || {};
			config.highlightOnLoad = typeof config.highlightOnLoad === 'boolean' ? config.highlightOnLoad : true;
			config.escapeHTML = typeof config.escapeHTML === 'boolean' ? config.escapeHTML : true;
			[].slice.call( document.querySelectorAll( '.reveal pre code' ) ).forEach( function( block ) {
				// Trim whitespace if the "data-trim" attribute is present
				if( !block.hasAttribute( 'data-notrim' ) && typeof block.innerHTML.trim === 'function' ) {
					block.innerHTML = betterTrim( block );
				}

				// Escape HTML tags unless the "data-noescape" attrbute is present
				if( config.escapeHTML && !block.hasAttribute( 'data-noescape' )) {
					block.innerHTML = block.innerHTML.replace( /</g, '&lt;').replace(/>/g, '&gt;');
				}

				// Re-highlight when focus is lost (for contenteditable code)
				block.addEventListener( 'focusout', function( event ) {
					highlightBlock( event.currentTarget );
				}, false );

				if( config.highlightOnLoad ) {
					RevealAtomHighlights.highlightBlock( block );
				}
			} );

		},

    highlightAuto: function ( text, languages /*taking array because HL.JS did */ ) {
      var config = (languages || [])[0];
      var configParts = (config || '').split(';');
      var language = (configParts || [])[0];
      var result = Highlighter.highlightSync({
        "fileContents": text,
        "filePath": language != null ? 'example.' + language : undefined
      });
      var highlightedLineNumbers = (configParts || [])[1];
      var highlighted = addLineNumbersBlockFor(result);
      if (!highlightedLineNumbers) {
        return highlighted;

      }
      return addLineHighlights(highlighted, highlightedLineNumbers);
    },

    highlightBlockImpl: function(block) {
      var node, originalStream, result, resultNode, text;
      var language = blockLanguage(block);

      node = block;
      text = node.textContent;
      result = RevealAtomHighlights.highlightAuto(text, language ? [language] : null);

      block.innerHTML = result;
      // block.className = buildClassName(block.className, language, result.language);
      // block.result = {
      //   language: result.language,
      //   re: result.relevance
      // };
    },

		/**
		 * Highlights a code block. If the <code> node has the
		 * 'data-line-numbers' attribute we also generate slide
		 * numbers.
		 *
		 * If the block contains multiple line highlight steps,
		 * we clone the block and create a fragment for each step.
		 */
		highlightBlock: function( block ) {

			RevealAtomHighlights.highlightBlockImpl( block );
      return;

			// Don't generate line numbers for empty code blocks
			if( block.innerHTML.trim().length === 0 ) return;

			if( block.hasAttribute( 'data-line-numbers' ) ) {
				window.atom_highlights.lineNumbersBlock( block, { singleLine: true } );

				// If there is at least one highlight step, generate
				// fragments
				var highlightSteps = RevealAtomHighlights.deserializeHighlightSteps( block.getAttribute( 'data-line-numbers' ) );
				if( highlightSteps.length > 1 ) {

					// If the original code block has a fragment-index,
					// each clone should follow in an incremental sequence
					var fragmentIndex = parseInt( block.getAttribute( 'data-fragment-index' ), 10 );
					if( typeof fragmentIndex !== 'number' || isNaN( fragmentIndex ) ) {
						fragmentIndex = null;
					}

					// Generate fragments for all steps except the original block
					highlightSteps.slice(1).forEach( function( highlight ) {

						var fragmentBlock = block.cloneNode( true );
						fragmentBlock.setAttribute( 'data-line-numbers', RevealAtomHighlights.serializeHighlightSteps( [ highlight ] ) );
						fragmentBlock.classList.add( 'fragment' );
						block.parentNode.appendChild( fragmentBlock );
						RevealAtomHighlights.highlightLines( fragmentBlock );

						if( typeof fragmentIndex === 'number' ) {
							fragmentBlock.setAttribute( 'data-fragment-index', fragmentIndex );
							fragmentIndex += 1;
						}
						else {
							fragmentBlock.removeAttribute( 'data-fragment-index' );
						}

					} );

					block.removeAttribute( 'data-fragment-index' )
					block.setAttribute( 'data-line-numbers', RevealAtomHighlights.serializeHighlightSteps( [ highlightSteps[0] ] ) );

				}

				RevealAtomHighlights.highlightLines( block );

			}

		},

		/**
		 * Visually emphasize specific lines within a code block.
		 * This only works on blocks with line numbering turned on.
		 *
		 * @param {HTMLElement} block a <code> block
		 * @param {String} [linesToHighlight] The lines that should be
		 * highlighted in this format:
		 * "1" 		= highlights line 1
		 * "2,5"	= highlights lines 2 & 5
		 * "2,5-7"	= highlights lines 2, 5, 6 & 7
		 */
		highlightLines: function( block, linesToHighlight ) {

			var highlightSteps = RevealAtomHighlights.deserializeHighlightSteps( linesToHighlight || block.getAttribute( 'data-line-numbers' ) );

			if( highlightSteps.length ) {

				highlightSteps[0].forEach( function( highlight ) {

					var elementsToHighlight = [];

					// Highlight a range
					if( typeof highlight.end === 'number' ) {
						elementsToHighlight = [].slice.call( block.querySelectorAll( 'table tr:nth-child(n+'+highlight.start+'):nth-child(-n+'+highlight.end+')' ) );
					}
					// Highlight a single line
					else if( typeof highlight.start === 'number' ) {
						elementsToHighlight = [].slice.call( block.querySelectorAll( 'table tr:nth-child('+highlight.start+')' ) );
					}

					if( elementsToHighlight.length ) {
						elementsToHighlight.forEach( function( lineElement ) {
							lineElement.classList.add( 'highlight-line' );
						} );

						block.classList.add( 'has-highlights' );
					}

				} );

			}

		},


		/**
		 * Serializes parsed line number data into a string so
		 * that we can store it in the DOM.
		 */
		serializeHighlightSteps: function( highlightSteps ) {

			return highlightSteps.map( function( highlights ) {

				return highlights.map( function( highlight ) {

					// Line range
					if( typeof highlight.end === 'number' ) {
						return highlight.start + RevealAtomHighlights.HIGHLIGHT_LINE_RANGE_DELIMITER + highlight.end;
					}
					// Single line
					else if( typeof highlight.start === 'number' ) {
						return highlight.start;
					}
					// All lines
					else {
						return '';
					}

				} ).join( RevealAtomHighlights.HIGHLIGHT_LINE_DELIMITER );

			} ).join( RevealAtomHighlights.HIGHLIGHT_STEP_DELIMITER );

		}

	}

  function addLineHighlights(highlightedCode, highlightedLineNumbers) {
    var lineIndexes = deserializeHighlightSteps(highlightedLineNumbers);
    // TODO: support fragments
    var allLineIndexes = [].concat.apply([], lineIndexes);
    var line = 0;
    var highlightedLines = highlightedCode.replace(/<div class="line">/g, function () {
      line++;
      if (allLineIndexes.indexOf(line) > -1) {
        return '<div class="line highlight-line">';
      }
      return '<div class="line">';
    });
    line = 0;
    var highlightedLinesAndGutter = highlightedLines.replace(/<div class="line-number">/g, function () {
      line++;
      if (allLineIndexes.indexOf(line) > -1) {
        return '<div class="line-number cursor-line cursor-line-no-selection">';
      }
      return '<div class="line-number">';
    });
    return highlightedLinesAndGutter
      .replace('<div class="lines">', '<div class="lines has-highlights">');
  }

  /**
   * Parses and formats a user-defined string of line
   * numbers to highlight.
   *
   * @example
   * deserializeHighlightSteps('1,2|3,5-10')
   * // [
   * //   [ 1, 2 ],
   * //   [ 3, 5, 6, 7, 8, 9, 10 ]
   * // ]
   */
  function deserializeHighlightSteps(highlightSteps) {
    var highlightLinesStepsWithoutWhiteSpace =
      highlightSteps.replace(/\s/g, '');
    var highlightLinesFragments = highlightSteps.split('|');

    return highlightLinesFragments.map(function(highlightLineGroups) {
      var indicesForFragment = [];
      highlightLineGroups.split(',').forEach(function(highlightLineGroup) {

        var parsed = highlightLineGroup.match(/(\d+)(?:-(\d+))?/);
        var startLine = parseInt(parsed[1], 10);
        var endLine = parseInt(parsed[2] || startLine, 10);

        for (var i = startLine; i <= endLine; i++) {
          indicesForFragment.push(i);
        }

      });
      return indicesForFragment;
    });
  }


  addStyles();

  function addStyles () {
      var css = document.createElement('style');
      css.type = 'text/css';
      css.innerHTML = '\
        /*Have to overrride so gutter border doesnt look weird*/\
        body .reveal pre code {\
          padding: 0;\
        }\
        .reveal pre code .gutter {\
          display: inline-block;\
          text-align: right;\
          opacity: 0.5;\
          background-color: rgba(0, 0, 0, 0.1);\
          padding: 1.2em 0.4em 1.2em 1em;\
        }\
        .reveal pre code .lines {\
          display: inline-block;\
          padding: 1.2em 1.2em 1.2em 0.2em;\
        }\
        .reveal .lines.has-highlights .line:not(.highlight-line) {\
        	opacity: 0.4;\
        }\
        ';


      document.getElementsByTagName('head')[0].appendChild(css);
  }

  function addLineNumbersBlockFor (inputHTML) {

      var numberOfLines = (inputHTML.match(/<div class="line">/g) || []).length;

      var lineNumbersHTML = '';

      for (var i = 0; i < numberOfLines; i++) {
          lineNumbersHTML += '<div class="line-number">' + (i + 1) + '</div>';
      }

      return '<div class="gutter line-numbers">' + lineNumbersHTML + '</div>' +
        '<div class="lines">' + inputHTML + '</div>';
  }


	Reveal.registerPlugin( 'highlight', RevealAtomHighlights );

	return RevealAtomHighlights;

}));
