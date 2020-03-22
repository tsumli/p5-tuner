import React from 'react';

export default class HerzOct extends React.Component {
    render(){
        return(
            <div className="herz_oct">
                <div className="oct_buttons">
                    <div id="octup" className="uptriangle" onClick={this.props.octClick}>
                    </div>
                    <div className="herz_name">
                        Octave:{this.props.oct}
                    </div>
                    <div id="octdown" className="downtriangle" onClick={this.props.octClick}>
                    </div>
                </div>
                <div className="herz_buttons">
                    <div id="Hzup" className="uptriangle" onClick={this.props.hzClick}>
                    </div>
                    <div className="herz_name">
                        A:{this.props.hz}Hz
                    </div>
                    <div id="Hzdown" className="downtriangle" onClick={this.props.hzClick}>
                    </div>
                </div>
            </div>
        );
    }
}