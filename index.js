(function(){
	//----------------------------------------------------------------------------------------------
	//
	// SEQUENCER
	//
	//----------------------------------------------------------------------------------------------

	// Path to the file containing the music blocks, relative to the document directory.
	//
	//     The order of the blocks in the file dictates the sequencer channel the blocks are
	//     assigned to. For example, the first block is assigned to channel zero, the
	//     second block is assigned to channel one, and so on.
	//
	//     For the purpose of this demo, each block is one bar long (i.e. four bars).
	//
	var _source = 'music/demo.ogg';

	// Beats per minute.
	var _sourceBPM = 100;

	// Beats per bar.
	var _sourceBPB = 4;

	// Initial music sequence.
	//
	//     Each sub-array represents a sequencer channel, and each channel consists of
	//     a sequence of flags (one per bar) that indicate if the block assigned to
	//     the channel should be played.
	//
	var _channels = [
		[ 0,0,0,0, 0,0,0,0, 1,1,1,1, 1,1,1,1 ], // Bass
		[ 0,0,0,0, 0,0,0,0, 1,1,1,1, 1,1,1,1 ], // Guitar
		[ 1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1 ], // Synth
		[ 0,0,0,0, 1,1,1,1, 0,0,0,0, 1,1,1,1 ], // Vox
		[ 1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1 ]  // Drums
	];

	// AudioBuffer, contains the decoded audio samples from the source file.
	var _audioBuffer = null;

	// AudioContext.
	var _audioContext = null;

	// ScriptProcessorNode.
	var _audioProcessor = null;

	// DynamicsCompressorNode.
	var _audioCompressor = null;

	// Sample length of a block of music, calculated after the audio devices have been created.
	var _blockLength = 0;

	// Sample position of the sequencer playhead.
	var _position = 0;

	// Indicates if the sequencer is playing.
	var _playing = false;

	// Number of times the processAudio() function has been invoked.
	var _processAudioCount = 0;

	// Number of seconds the processAudio() function has been running for.
	var _processAudioTime = 0;

	//
	function initializeSequencer() {
		if( window.AudioContext !== undefined ) {
			_audioContext = new AudioContext();
		} else if( window.webkitAudioContext !== undefined ) {
			_audioContext = new webkitAudioContext();
		} else if( window.mozAudioContext !== undefined ) {
			_audioContext = new mozAudioContext();
		} else {
			// The Web Audio API is unavailable.
			return false;
		}

		_audioProcessor  = _audioContext.createScriptProcessor( 4096 );
		_audioCompressor = _audioContext.createDynamicsCompressor();

		// Tweak the compressor settings because the default compression is too heavy.
		_audioCompressor.ratio.value     = 4;
		_audioCompressor.threshold.value = -16;

		// The processor sends samples to the compressor.
		_audioProcessor.connect( _audioCompressor );
		// The compressor sends samples to the hardware.
		_audioCompressor.connect( _audioContext.destination );

		// Listen for processor events.
		_audioProcessor.onaudioprocess = processAudio;

		// samples = floor( sample_rate * ( 60 / ( beats_per_minutes / beats_per_bar ) ) )
		_blockLength = Math.floor( _audioContext.sampleRate * ( 60 / ( _sourceBPM / _sourceBPB ) ) );

		loadBlocks();

		return true;
	}

	//
	function play() {
		_playing  = true;
		_position = 0;

		updateGUI();
	}

	//
	function stop() {
		_playing  = false;
		_position = 0;

		updateGUI();
	}

	//
	function countBars() {
		return _channels[ 0 ].length;
	}

	//
	function countChannels() {
		return _channels.length;
	}

	//
	function getBar() {
		if( _blockLength !== 0 ) {
			return Math.floor( _position / _blockLength );
		}
		return 0;
	}

	//
	function getBlock( channel, bar ) {
		return _channels[ channel ][ bar ];
	}

	//
	function setBlock( channel, bar, value ) {
		_channels[ channel ][ bar ] = ( value === 1 ? 1 : 0 );
	}

	//
	function loadBlocks() {
		var loader = new XMLHttpRequest();

		loader.open( 'GET', _source );
		loader.responseType = 'arraybuffer';
		loader.onload = blocksLoaded;

		loader.send();
	}

	//
	function blocksLoaded( event ) {
		var loader = event.target;

		loader.onload = null;

		if( loader.status >= 400 ) {
			// The file failed to load.
			return;
		}

		_audioContext.decodeAudioData( loader.response, blocksDecoded, blocksDecoded );
	}

	//
	function blocksDecoded( buffer ) {
		if( buffer === undefined ) {
			// The file could not be decoded.
			alert( 'Sorry, the browser you are using does not support OGG audio' );
			return;
		}

		_audioBuffer = buffer;

		showGUI();
	}

	//
	function processAudio( event ) {
		var output       = event.outputBuffer;
		var outputL      = output.getChannelData( 0 );
		var outputR      = output.getChannelData( 1 );
		var outputIndex  = 0;
		var outputLength = output.length;

		if( _playing === false ) {
			while( outputIndex < outputLength ) {
				outputL[ outputIndex ] = 0;
				outputR[ outputIndex ] = 0;

				outputIndex ++;
			}
			return;
		}

		var input       = _audioBuffer;
		var inputL      = input.getChannelData( 0 );
		var inputR      = input.getChannelData( 1 );
		var inputIndex  = 0;
		var inputLength = input.length;

		var chnIndex    = 0;
		var chnCount    = countChannels();
		var barIndex    = 0;
		var barPosition = 0;
		var seqLength   = _channels[ 0 ].length * _blockLength;

		while( outputIndex < outputLength ) {
			chnIndex = 0;

			outputL[ outputIndex ] = 0;
			outputR[ outputIndex ] = 0;

			while( chnIndex < chnCount ) {
				barIndex = _position / _blockLength >> 0;

				if( _channels[ chnIndex ][ barIndex ] === 1 ) {
					barPosition = _position % _blockLength;
					inputIndex  = _blockLength * chnIndex + barPosition;

					if( inputIndex < inputLength ) {
						outputL[ outputIndex ] += inputL[ inputIndex ];
						outputR[ outputIndex ] += inputR[ inputIndex ];
					}
				}

				chnIndex ++;
			}

			_position ++;

			if( _position >= seqLength ) {
				_position = 0;
			}

			outputIndex ++;
		}

		updateGUI();
	}

	//----------------------------------------------------------------------------------------------
	//
	// GUI
	//
	//----------------------------------------------------------------------------------------------

	//
	function initializeGUI() {
		var i;
		var n;
		var element;

		// Grab a reference to the sequencer element.
		element = document.getElementById( 'sequencer' );

		// Create the elements that represent the sequencer channels.
		i = 0;
		n = countChannels();

		while( i < n ) {
			createChannel( element, i );
			i ++;
		}

		alignGUI();
		window.onresize = alignGUI;

		// Listen for button clicks.
		document.getElementById( 'play' ).onclick = buttonClicked;
		document.getElementById( 'stop' ).onclick = buttonClicked;
	}

	//
	function createChannel( container, index ) {
		var i;
		var n;
		var element;

		// Create the element that represents the channel.
		element = document.createElement( 'div' );

		element.setAttribute( 'class', 'channel' );
		element.setAttribute( 'index', String(index) );

		// Create the elements that represent the sequencer blocks.
		i = 0;
		n = countBars();

		while( i < n ) {
			createBlock( element, index, i );
			i ++;
		}

		// Add the channel element to the container.
		container.appendChild( element );
	}

	//
	function createBlock( container, channel, index ) {
		var element;

		// Create the element that represents the block.
		element = document.createElement( 'div' );

		element.setAttribute( 'class', 'block' );
		element.setAttribute( 'index', String(index) );

		// Check if the block is already active.
		if( getBlock( channel, index ) === 1 ) {
			element.classList.add( 'active' );
		}

		// Listen for block clicks.
		element.onclick = blockClicked;

		// Add the element to the container.
		container.appendChild( element );
	}

	//
	function showGUI() {
		document.getElementById( 'interface' ).classList.add( 'visible' );
	}

	//
	function alignGUI() {
		var element   = document.getElementById( 'interface' );
		var container = element.parentElement;

		// Move the interface to the middle of the window.
		element.style.top  = Math.round( ( container.offsetHeight - element.offsetHeight ) * 0.5 ) + 'px';
		element.style.left = Math.round( ( container.offsetWidth  - element.offsetWidth  ) * 0.5 ) + 'px';
	}

	//
	function updateGUI() {
		var element = document.getElementById( 'position' );

		// Move the indicator to highlight the active sequencer bar.
		element.style.left = ( getBar() * element.offsetWidth ) + 'px';
	}

	//
	function blockClicked( event ) {
		var element;
		var block;
		var channel;

		if( event.button !== 0 ) {
			return;
		}

		element = event.target;
		block   = element.getAttribute( 'index' ) - 0;
		channel = element.parentElement.getAttribute( 'index' ) - 0;

		// Toggle the sequencer block.
		if( element.classList.contains( 'active' ) === false ) {
			element.classList.add( 'active' );
			setBlock( channel, block, 1 );
		} else {
			element.classList.remove( 'active' );
			setBlock( channel, block, 0 );
		}
	}

	//
	function buttonClicked( event ) {
		var element;

		if( event.button !== 0 ) {
			return;
		}

		element = event.target;

		if( element.getAttribute( 'id' ) === 'play' ) {
			play();
		} else {
			stop();
		}
	}

	//----------------------------------------------------------------------------------------------
	//
	// BOOTSTRAP
	//
	//----------------------------------------------------------------------------------------------

	//
	function main( event ) {
		window.onload = null;

		if( initializeSequencer() === false ) {
			// The Web Audio API is unavailable.
			alert( 'Sorry, the browser you are using does not support the Web Audio API' );
			return;
		}

		initializeGUI();
	}

	window.onload = main;

})();
