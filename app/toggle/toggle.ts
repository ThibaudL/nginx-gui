const template = require('./toggle.html');
import './toggle.css';

export default class Toggle {

    public static selector = 'toggle';
    public static component = {
        template,
        controller: Toggle,
        bindings: {
            ngModel: '=',
            ngDisabled: '<?',
            ngChange: '&?',
            labelOn: '@',
            labelOff: '@',
        }
    };


    private ngModel: boolean = false;
    private ngDisabled: boolean;
    private labelOn: string = 'On';
    private labelOff: string = 'Off';
    private label: string;
    private ngChange: Function;
    private $viewChangeListeners: any = [];

    public static $inject: string[] = ['$timeout'];

    constructor(private $timeout) {
    }

    $onInit() {
        this.label = this.ngModel ? this.labelOn : this.labelOff;
    }

    toggle() {
        if (!this.ngDisabled) {
            this.ngModel = !this.ngModel;
            this.label = this.ngModel ? this.labelOn : this.labelOff;
            if (this.ngChange) {
                this.$timeout(() => {
                    this.ngChange();
                })
            }
        }
    }
}