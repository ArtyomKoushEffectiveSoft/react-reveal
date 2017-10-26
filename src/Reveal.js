/*
 * RevealBase Component For react-reveal
 *
 * Copyright © Roman Nosov 2016, 2017
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */
import React from 'react';
import { string, object, number, bool, func, node, any, oneOfType } from 'prop-types';
import { namespace, ssr, disableSsr, globalHide } from './lib/globals';
import Step from './lib/Step';
import debounce from './lib/debounce';

const
  propTypes = {
    when: oneOfType([bool, Step]),
    spy: any,
    effect: string,
    collapse: string,
    duration: number,
    delay: number,
    count: number,
    forever: bool,
    tag: string,
    className: string,
    style: object,
    props: object,
    force: bool,
    fraction: number,
    onReveal: func,
    children: node.isRequired,
    in: object,
    out: oneOfType([object, bool]),
  },
  defaultProps = {
    duration: 1000,
    delay: 0,
    count: 1,
    fraction: 0.2,
    tag: 'div',
    when: true,
  };

class RevealBase extends React.Component {

  constructor(props) {
    super(props);
    this.state = { 
      legacyMode: false, 
      style: props.when || !props.out 
        ? {} 
        : (props.collapse?{maxHeight: 0,...RevealBase.getStyle(false)}:RevealBase.getStyle(false))
    };
    this.isListener = 0;
    this.isAnimated = false;
    this.reveal = this.reveal.bind(this);
    this.revealHandler = debounce(this.reveal, 66);
    this.concealHandler = debounce(this.conceal.bind(this), 66);
    this.resizeHandler = debounce(this.resize.bind(this), 500);
    this.saveRef = el => this.el = el;
  }

  static getStyle(visible) {
    return { visibility: visible?'visible':'hidden' };//, opacity: visible ? 1 : 0 };
  }

  static getTop(el) {
    while (el.offsetTop === void 0)
      el = el.parentNode;
    let top = el.offsetTop;
    for (;el.offsetParent; top += el.offsetTop)
      el = el.offsetParent;
    return top;
  }

  inViewport() {
    if (!this.el || window.document.hidden) return false;
    const h = this.el.offsetHeight,
          delta = window.pageYOffset - RevealBase.getTop(this.el),
          tail = Math.min(h, window.innerHeight) * ( globalHide ? this.props.fraction : 0 );
    return ( delta > tail - window.innerHeight ) && ( delta < h - tail );
  }

  hide() {
    if (this.props.out)      
      this.setState({ style: RevealBase.getStyle(false) }); 
      //this.setState(this.props.collapse
      //  ?{ style: {maxHeight: 0, transition: `all ${this.props.duration}ms`,opacity: 0}}//...RevealBase.getStyle(false),  }}
      //  :{ style: RevealBase.getStyle(false) }); 
  }

  resize() {
    if (!this||!this.el||!this.props.when) return;    
    if ( !this.isAnimated && (this.props.force || this.inViewport()) ) {
      this.isAnimated = true;
      this.setState({ style: RevealBase.getStyle(this.props.when) });
      if (this.props.onReveal && this.props.when)
        this.animationEnd(this.props.onReveal);
    }
  }

  log(i, start, end, duration, total) {
    const minv = Math.log(duration);
    const maxv = Math.log(total);
    const scale = (maxv-minv) / (end-start);
    return Math.exp(minv + scale*(i-start));
  }

  animationEnd(arg) {
    if (this.props.forever) return;
    window.setTimeout( () => {
      if (!this || !this.el) return;
      switch (typeof arg) {
        case 'object': 
          this.setState({ style: {...this.state.style, ...arg} }); break;
        case 'function':
          arg(); break;
        default:
          if (!this.props.when && this.props.out)
            this.setState({ style: { ...this.state.style, visibility: 'hidden' } });
      }
    }, this.props.delay + this.props.count*
      (this.props.duration + this.props.cascade? (this.props.cascade===true?1000:this.props.cascade) : 0)
    );
  }

  animate() {
    this.clean();
    if(this.props.effect)
      this.setState({ legacyMode: true });
    else {
      const inOut = this.props[this.props.when?'in':'out'],
            animation = `${inOut.animation||inOut.make()} ${this.props.duration}ms ease ${this.props.delay}ms ${this.props.forever?'infinite':this.props.count} normal both`;      
      if ( this.state.style.animation === animation ) 
        return;
      this.setState({ style: { animation, visibility:'visible', ...inOut.style } });
      if (!this.props.out || (this.props.when&&'spy' in this.props))
        this.animationEnd({ animation: void 0 });
      else if(!this.props.when) 
        this.animationEnd();
    }
    this.isAnimated = true;
    if (this.props.onReveal && this.props.when)
      this.animationEnd(this.props.onReveal);      
  }

  clean() {
    if (this.isListener) {
      const handler = this[this.isListener === -1?'concealHandler':'revealHandler'];
      window.removeEventListener('scroll', handler);
      window.removeEventListener('orientationchange', handler);
      window.document.removeEventListener('visibilitychange', handler);
      window.removeEventListener('resize', this.resizeHandler);
      this.isListener = false;
    }
  }

  componentWillUnmount() {
    this.clean();
    ssr && disableSsr();
  }

  componentDidUpdate({ when, spy }) {
    if ( (when !== this.props.when ) || (spy !== this.props.spy)) {
      this.isAnimated = false;
      this.props.when?this.reveal():this.conceal();
    }
  }

  listen(dir) {
    if (!this.isListener && !this.props.force ) {
      this.isListener = dir;
      const handler = this[this.isListener === -1?'concealHandler':'revealHandler'];
      window.addEventListener('scroll', handler);
      window.addEventListener('orientationchange', handler);
      window.document.addEventListener("visibilitychange", handler);
      window.addEventListener('resize', this.resizeHandler);
    }
    return this;
  }

  reveal() {
    if (!this||!this.el||!this.props.when) return;    
    if ( !this.isAnimated ) {
      this.listen(1);
      if ( this.props.force || this.inViewport() ) {
        if (this.start) {
          this.hide();
          this.start(this.step);
          return;
        }
        else
          this.animate();
      }      
    }
  }

  conceal() {
    if (!this||!this.el||this.props.when) return;
    if ( !this.isAnimated && this.props.out ) {
      //---this.animate();      
      this.listen(-1);
      if (this.inViewport())
        this.animate();
      //else this.setState({ style: RevealBase.getStyle(true)});
        //this.hide();
    }
  }

  componentDidMount() {
    if (!this.el) return;
    if (this.props.when instanceof Step)
      this.props.when.push(this);
    else if (this.props.step) // todo: remove in 0.8.0
      this.props.step.push(this);
    if ( ssr && (this.props.out||this.props.effect) && RevealBase.getTop(this.el) < window.pageYOffset + window.innerHeight ) {
      this.setState({ style: { opacity: 0, transition: 'opacity 1000ms' } });
      window.setTimeout(this.reveal, 1000);
    }
    else
      this.reveal();
  }

  render() {
    const { tag: TagName, id, children, style, className } = this.props,
      newClass = `${ this.state.legacyMode ? this.props.effect : ( !this.props.out && !this.props.effect ? '' : namespace ) }${ className ? ' ' + className : '' }`||void 0;
    let newStyle, newChildren= false;
    if (!this.state.legacyMode) {
       newStyle = {...style, ...this.state.style};
      let reverse = false;
      if (this.props.cascade && children && this.state.style.animation) {
        if (typeof children === 'string') {
          newChildren = children.split("").map( (ch, index) => <span key={index} style={{display: 'inline-block', whiteSpace:'pre'}}>{ch}</span> );
          reverse = this.props.reverse;
        }
        else
          newChildren = React.Children.toArray(children);
        const count = newChildren.length - 1,
              total =  this.props.duration + (typeof this.props.cascade === 'boolean' ? 1000 : this.props.cascade);
        let i = reverse ? count : 0;
        newChildren = newChildren.map( child =>
          React.cloneElement(child,{style: {...child.props.style, ...this.state.style,
            animationDuration: Math.round(this.log( reverse ? i-- : i++ ,0 ,count, this.props.duration, total)) + 'ms',
          }}));
        newStyle.animation = void 0;       
      }
    }
    return <TagName
        id={id}
        {...(this.props.props||void 0)}
        className={newClass}
        style={this.state.legacyMode?style:newStyle}
        children={newChildren||children}
        ref={this.saveRef}
    />;
  }

}

RevealBase.propTypes = propTypes;
RevealBase.defaultProps = defaultProps;
export default RevealBase;
