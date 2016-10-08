/*
	MBTweener version 1.1.0
	
	MBTween, MBTweener: Copyright © 2015 MBMedia.cc | for info go to http://mbmedia.cc/stuff/mbtweener
	Easing Equations: Copyright © 2001 Robert Penner All rights reserved.
	
	TERMS OF USE - Open source under the BSD License.
	
	Redistribution and use in source and binary forms, with or without
	modification, are permitted provided that the following conditions are met:
	
	Redistributions of source code must retain the above copyright notice, this
	list of conditions and the following disclaimer. Redistributions in binary
	form must reproduce the above copyright notice, this list of conditions and
	the following disclaimer in the documentation and/or other materials provided
	with the distribution. Neither the name of the author nor the names of
	contributors may be used to endorse or promote products derived from this
	software without specific prior written permission.
	
	THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
	AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
	IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
	DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE
	FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
	DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
	SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
	CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
	OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
	OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/


/**
Creates a new tween to be run. Is not self managing, you set up a bunch tweening the same object/property it's gonna try to do it all. For managed usage see MBTweener static class.
@arg target - The object whose properties you want to tween
@arg duration - The duration of the tween in milliseconds
@arg properties - The properties/values to tween to in the form of an object with number values, like {x:20, y:10}. To have a from AND to value use an array [fromObj, toObj]
@arg settings - set the easing, suffix, onBegin, onCancel, onComplete, onStop (which calls on cancel OR complete), dirty, data, react, states and round properties via an object
@note - onBegin, onStop, onCancel and onComplete functions will recieve 2 parameters: the tween object itself and any data object that was included in the settings parameter (respectively)
@note - if the react property (the instance of the react object to update) is used without a states property then it will update states of the same name as the property names given for the tween. If a states object is used then you can define state names to update and which tweened property they should match, for example states:{tweenedProp:'stateName'}
**/
var MBTween = function(obj, millis, props, settings)
{
	/**
	Accessible properties to set the same props as the constructor shortcut arguments
	**/
	this.target = obj;
	this.duration = millis;
	this.fromProps = props instanceof Array ? props[0] : null;
	this.props = props instanceof Array ? props[1] : props;
	this.settings = settings;
	this.running = false;
	
	// protected
	this.internalTweens = [];
	this.totalTicks = 0;
	this.ticksToDo = 0;
}
	
	/**
	Starts the current tween. Make sure to have all settings/properties for the tween set before calling this.
	Returns the tween itself so that the format "var tween = new MBTween(...).start();" can work.
	**/
	MBTween.prototype.start = function()
	{
		MBTween.startStaticTick();
		
		this.totalTicks = 0;
		this.ticksToDo = this.duration/1000 * fixed_fps;
		
		if (!this.settings.hasOwnProperty('easing'))
			this.settings.easing = MBTween.defaultEase;
		
		var noNums = /\-?\d*/g;
		for (var k in this.props) {
			var origVal = this.fromProps ? parseFloat(this.fromProps[k]) : parseFloat(this.target[k]);
			var endVal = parseFloat(this.props[k]);
			var propSuffix = isNaN(this.props[k]) ? this.props[k].replace(noNums,'') : false;
			if (isNaN(origVal)) origVal = k=='opacity' ? 1 : 0;
			if (this.fromProps) this.target[k] = this.fromProps[k] + (this.settings.hasOwnProperty('suffix') ? this.settings.suffix : 0);
			this.internalTweens.push([this.target, k, origVal, endVal-origVal, propSuffix]); // [target, propName, startNum, changeInNum, propSuffix]
		}
		
		MBTween.activeTweens.push(this);
		
		this.running = true;
		
		if (typeof this.settings.onBegin === 'function')
			this.settings.onCancel(this, this.settings.data);
		
		return this;
	}
	
	/**
	Stops the current tween. Will invoke your "onCancel" function if used. Also called automatically when one MBTweener call overrides another (and likewise calls onCancel). Does NOT call the onCancel (or onStop) event unless it was actually active (i.e. instance.running was true) when called.
	**/
	MBTween.prototype.stop = function()
	{
		if (!this.running) return false;
		
		this.removeFromActive();
		this.running = false;
		
		var settings = this.settings;
		
		if (settings.react)
			this.reactUpdateStates();
		
		if (typeof settings.onCancel === 'function')
			settings.onCancel(this, settings.data);
		
		if (typeof settings.onStop === 'function')
			settings.onStop(this, settings.data);
		
		return true;
	}
	
	// protected
	MBTween.prototype.internalComplete = function()
	{
		this.removeFromActive();
		this.running = false;
		
		var settings = this.settings;
		
		if (settings.react)
			this.reactUpdateStates();
		
		if (typeof settings.internalComplete === 'function')
			settings.internalComplete(this, this.settings.data);
		
		if (typeof settings.onComplete === 'function')
			settings.onComplete(this, settings.data);
		
		if (typeof settings.onStop === 'function')
			settings.onStop(this, settings.data);
	}
	
	// protected
	MBTween.prototype.reactUpdateStates = function()
	{
		var settings = this.settings;
		
		if (settings.states) {
			for (var key in settings.states) {
				var obj = {};
				obj[settings.states[key]] = this.target[key];
				settings.react.setState(obj);
			}
		} else {
			for (var key in this.props) {
				var obj = {};
				obj[key] = this.target[key];
				settings.react.setState(obj);
			}
		}
	}
	
	// protected
	MBTween.prototype.nextTick = function()
	{
		this.totalTicks++;
		var isDone = this.totalTicks >= this.ticksToDo;
		
		var cTime = this.totalTicks * frame_time;
		for (var i=0,ii=this.internalTweens.length; i<ii; i++)
		{
			var n = isDone ? this.internalTweens[i][2]+this.internalTweens[i][3] : MBEasing[this.settings.easing](cTime, this.internalTweens[i][2], this.internalTweens[i][3], this.duration);
			
			if (this.settings.round)
				n = Math.round(n);
			
			if (this.internalTweens[i][4]) { // if individual suffix
				n = n + this.internalTweens[i][4];
			} else if (this.settings.hasOwnProperty('suffix')) { // if no individual, and is a settings one, use that
				n = n + this.settings.suffix;
			}
			
			this.internalTweens[i][0][ this.internalTweens[i][1] ] = n;
			
			if (this.settings.dirty && this.this.internalTweens[i][0].hasOwnProperty('dirty'))
				this.internalTweens[i][0].dirty = true;
		}
		
		if (isDone)
			this.internalComplete();
	}
	
	// protected
	MBTween.prototype.removeFromActive = function()
	{
		var index = MBTween.activeTweens.indexOf(this);
		if (index === -1) return false;
		
		MBTween.activeTweens.splice(index, 1);
		return true;
	}

/**
Sets the frames per second that the tweening engine operates at. Must be set BEFORE any tweens are created/used.
**/
MBTween.FPS = 30;

// both store the values of framerate data after the loop is started
var fixed_fps = NaN;
var frame_time = NaN;

/**
Determins the default easing function that will be used when none is specified in the call
**/
MBTween.defaultEase = 'easeInOutSine';

// protected
MBTween.isTicking = false;
MBTween.ticker = null;
MBTween.activeTweens = [];

// protected
MBTween.onStaticTick = function()
{
	for (var i=MBTween.activeTweens.length-1; i>-1; i--)
		MBTween.activeTweens[i].nextTick();
}

// protected
MBTween.startStaticTick = function()
{
	if (MBTween.isTicking) return;
	
	fixed_fps = MBTween.FPS;
	frame_time = 1000/fixed_fps;
	
	MBTween.ticker = setInterval(MBTween.onStaticTick, frame_time);
	MBTween.isTicking = true;
}

/**
Allows you to add any amount of arguments as MBTween objects which will play from one to the next.
**/
MBTween.chain = function()
{
	for (var i=0,ii=arguments.length-1; i<ii; i++)
	{
		var curTween = arguments[i];
		curTween.nextTween = arguments[i+1];
		curTween.settings.internalComplete = function(t){ t.nextTween.start(); };
	}
	
	arguments[0].start();
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////


/**
Pass the "easing" value to the tween's "settings" property. Takes a string representing the easing function, such as {easing:'easeInSine'}
Default is 'easeInOutSine'. Possible values are as follows:
'linear'
'easeInSine'
'easeOutSine'
'easeInOutSine' (and 'swing'...same thing)
'easeInExpo'
'easeOutExpo'
'easeInOutExpo'
'easeInElastic'
'easeOutElastic'
'easeInOutElastic'
'easeInCircular'
'easeOutCircular'
'easeInOutCircular'
'easeInBack'
'easeOutBack'
'easeInOutBack'
'easeInBounce'
'easeOutBounce'
'easeInOutBounce'
'easeInCubic'
'easeOutCubic'
'easeInOutCubic'
**/
var MBEasing = {};

// t: current time, b: begInnIng value, c: change In value, d: duration

// protected
MBEasing.PI_M2 = Math.PI*2;
MBEasing.PI_D2 = Math.PI/2;

// Linear
MBEasing.linear = function(t, b, c, d)
	{ return c*t/d + b; }

// Sine
MBEasing.easeInSine = function(t, b, c, d)
	{ return -c * Math.cos(t/d * MBEasing.PI_D2) + c + b; }
MBEasing.easeOutSine = function(t, b, c, d)
	{ return c * Math.sin(t/d * MBEasing.PI_D2) + b; }
MBEasing.easeInOutSine = MBEasing.swing = function(t, b, c, d)
	{ return -c/2 * (Math.cos(Math.PI*t/d) - 1) + b; }

// Exponential
MBEasing.easeInExpo = function(t, b, c, d)
	{ return (t==0) ? b : c * Math.pow(2, 10 * (t/d - 1)) + b; }
MBEasing.easeOutExpo = function(t, b, c, d)
	{ return (t==d) ? b+c : c * (-Math.pow(2, -10 * t/d) + 1) + b; }
MBEasing.easeInOutExpo = function(t, b, c, d)
{
	if (t==0) return b; if (t==d) return b+c;
	if ((t/=d/2) < 1) return c/2 * Math.pow(2, 10 * (t - 1)) + b;
	return c/2 * (-Math.pow(2, -10 * --t) + 2) + b;
}

// Elastic
MBEasing.easeInElastic = function(t, b, c, d, a, p)
{
	var s;
	if (t==0) return b;  if ((t/=d)==1) return b+c;  if (!p) p=d*.3;
	if (!a || a < Math.abs(c)) { a=c; s=p/4; }
	else s = p/MBEasing.PI_M2 * Math.asin (c/a);
	return -(a*Math.pow(2,10*(t-=1)) * Math.sin( (t*d-s)*MBEasing.PI_M2/p )) + b;
}
MBEasing.easeOutElastic = function(t, b, c, d, a, p)
{
	var s;
	if (t==0) return b;  if ((t/=d)==1) return b+c;  if (!p) p=d*.3;
	if (!a || a < Math.abs(c)) { a=c; s=p/4; }
	else s = p/MBEasing.PI_M2 * Math.asin (c/a);
	return (a*Math.pow(2,-10*t) * Math.sin( (t*d-s)*MBEasing.PI_M2/p ) + c + b);
}
MBEasing.easeInOutElastic = function(t, b, c, d, a, p)
{
	var s;
	if (t==0) return b;  if ((t/=d/2)==2) return b+c;  if (!p) p=d*(.3*1.5);
	if (!a || a < Math.abs(c)) { a=c; s=p/4; }
	else s = p/MBEasing.PI_M2 * Math.asin (c/a);
	if (t < 1) return -.5*(a*Math.pow(2,10*(t-=1)) * Math.sin( (t*d-s)*MBEasing.PI_M2/p )) + b;
	return a*Math.pow(2,-10*(t-=1)) * Math.sin( (t*d-s)*MBEasing.PI_M2/p )*.5 + c + b;
}

// Circular
MBEasing.easeInCircular = function(t, b, c, d)
	{ return -c * (Math.sqrt(1 - (t/=d)*t) - 1) + b; }
MBEasing.easeOutCircular = function(t, b, c, d)
	{ return c * Math.sqrt(1 - (t=t/d-1)*t) + b; }
MBEasing.easeInOutCircular = function(t, b, c, d)
{
	if ((t/=d/2) < 1) return -c/2 * (Math.sqrt(1 - t*t) - 1) + b;
	return c/2 * (Math.sqrt(1 - (t-=2)*t) + 1) + b;
}

// Back
MBEasing.easeInBack = function(t, b, c, d)
	{ var s = 1.70158; return c*(t/=d)*t*((s+1)*t - s) + b; }
MBEasing.easeOutBack = function(t, b, c, d)
	{ var s = 1.70158; return c*((t=t/d-1)*t*((s+1)*t + s) + 1) + b; }
MBEasing.easeInOutBack = function(t, b, c, d)
{
	var s = 1.70158;
	if ((t/=d/2) < 1) return c/2*(t*t*(((s*=(1.525))+1)*t - s)) + b;
	return c/2*((t-=2)*t*(((s*=(1.525))+1)*t + s) + 2) + b;
}

// Bounce
MBEasing.easeInBounce = function(t, b, c, d)
	{ return c - MBEasing.easeOutBounce (d-t, 0, c, d) + b; }
MBEasing.easeOutBounce = function(t, b, c, d)
{
	if ((t/=d) < (1/2.75)) {
		return c*(7.5625*t*t) + b;
	} else if (t < (2/2.75)) {
		return c*(7.5625*(t-=(1.5/2.75))*t + .75) + b;
	} else if (t < (2.5/2.75)) {
		return c*(7.5625*(t-=(2.25/2.75))*t + .9375) + b;
	} else {
		return c*(7.5625*(t-=(2.625/2.75))*t + .984375) + b;
	}
}
MBEasing.easeInOutBounce = function(t, b, c, d)
{
	if (t < d/2) return MBEasing.easeInBounce (t*2, 0, c, d) * .5 + b;
	else return MBEasing.easeOutBounce (t*2-d, 0, c, d) * .5 + c*.5 + b;
}

// Cubic
MBEasing.easeInCubic = function(t, b, c, d)
	{ return c*(t/=d)*t*t + b; }
MBEasing.easeOutCubic = function(t, b, c, d)
	{ return c*((t=t/d-1)*t*t + 1) + b; }
MBEasing.easeInOutCubic = function(t, b, c, d)
{
	if ((t/=d/2) < 1) return c/2*t*t*t + b;
	return c/2*((t-=2)*t*t + 2) + b;
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////


var MBTweener = {};
// protected
MBTweener.objects = [];
MBTweener.tweens = [];

/**
Begins a new tween on an object. Will also stop any currently running MBTweener handled tweens on that object.
@arg target - The object whose properties you want to tween
@arg duration - The duration of the tween in milliseconds
@arg properties - The properties/values to tween to in the form of an object with number values, like {x:20, y:10} To have a from AND to value use an array [fromObj, toObj]
@arg settings - set the easing, suffix, onCancel, onComplete, onStop (calls on cancel or complete), data, and round properties via an object
@note - onStop, onCancel and onComplete functions will recieve 2 parameters: the tween object itself and any data object that was included in the settings parameter (respectively)
**/
MBTweener.to = function(obj, millis, props, settings)
{
	if (MBTweener.objects.indexOf(obj) != -1)
		MBTweener.stop(obj);
	
	if (settings == undefined) settings = {};
	settings.internalComplete = MBTweener.stop;
	var newTween = new MBTween(obj, millis, props, settings);
	MBTweener.objects.push(obj);
	MBTweener.tweens.push(newTween);
	
	newTween.start();
	return newTween;
}

/**
Stops the MBTweener handled tweens on the object given as the parameter.
**/
MBTweener.stop = function(obj)
{
	var index = MBTweener.objects.indexOf(obj);
	if (index == -1) return false;
	
	MBTweener.objects.splice(index, 1);
	var t = MBTweener.tweens.splice(index, 1)[0];
	
	t.stop();
	
	return true;
}

/**
Stops all tweens being used via the MBTweener class, and clears the ticker as well.
**/
MBTweener.stopAll = function()
{
	while (MBTweener.objects.length > 0)
		MBTweener.stop(MBTweener.objects[0]);
	
	clearInterval(MBTween.ticker);
	MBTween.isTicking = false;
}

/**
Can be used in a MBTween.chain call instead of a normal MBTween object to make a delay, used as: new MBTweenDelay(1000)
**/
var MBTweenDelay = function(time)
{
	this.settings = {};
	this.start = function()
		{ setTimeout(this.settings.onComplete, time, this); }
};